
import { OrchestratedResult, ValidationIssue, TPRuleSet } from '../types';
import { validateRealTime } from '../utils/ediValidator';
import { validateEdiContent } from './geminiService';
import { StediValidationService } from './stediValidationService';
import { rulesEngine } from './rulesEngine';

/**
 * Validation Orchestrator
 * Combines Local Regex, AI Logic, External API, and Trading Partner Rules.
 */
export const validationOrchestrator = {
  
  async validate(
    ediContent: string, 
    options: { 
      useAi: boolean; 
      useStedi?: boolean; 
      stediConfig?: any;
      activeRuleSets?: TPRuleSet[];
      aiProvider?: 'gemini' | 'deepseek';
    }
  ): Promise<OrchestratedResult> {
    
    const issues: ValidationIssue[] = [];
    const provider = options.aiProvider || 'gemini';
    
    // 1. Local Syntax Validation (Fast, Deterministic)
    const localResult = validateRealTime(ediContent);
    localResult.errors.forEach(err => {
      issues.push({
        code: err.code,
        message: err.message,
        severity: err.severity,
        line: err.line,
        source: 'LOCAL'
      });
    });

    // 2. Trading Partner Rules
    if (options.activeRuleSets && options.activeRuleSets.length > 0) {
        options.activeRuleSets.forEach(set => {
            if (!set.isActive) return;
            const ruleIssues = rulesEngine.validate(ediContent, set.rules);
            issues.push(...ruleIssues);
        });
    }

    // 3. AI Logic Validation (Context Aware)
    if (options.useAi) {
      try {
        const aiErrors = await validateEdiContent(ediContent, provider);
        if (aiErrors && aiErrors.length > 0) {
          aiErrors.forEach(err => {
             issues.push({
               code: 'AI_VAL',
               message: err.message,
               severity: 'ERROR',
               source: 'AI',
               line: err.line,
               segmentId: (err as any).segment,
               elementId: (err as any).element,
               suggestion: err.fix,
               explanation: err.explanation,
               reason: err.reason,
               range: err.range
             });
          });
        }
      } catch (e) {
        console.error("AI Validation Error", e);
      }
    }

    // 4. Stedi Validation
    if (options.useStedi && options.stediConfig?.apiKey) {
       const stediService = new StediValidationService(
           options.stediConfig.apiKey, 
           options.stediConfig.partnershipId, 
           options.stediConfig.transactionSettingId
       );
       const stediIssues = await stediService.validate(ediContent);
       issues.push(...stediIssues);
    }

    // 5. Calculate Score
    const errorCount = issues.filter(i => i.severity === 'ERROR').length;
    const warningCount = issues.filter(i => i.severity === 'WARNING').length;
    
    let score = 100 - (errorCount * 10) - (warningCount * 2);
    score = Math.max(0, score);

    return {
      isValid: errorCount === 0,
      score,
      issues,
      metrics: {
        segmentCount: ediContent.split("'").length + ediContent.split("~").length,
        errorCount,
        warningCount
      }
    };
  }
};
