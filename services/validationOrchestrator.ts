
import { OrchestratedResult, ValidationIssue } from '../types';
import { validateRealTime } from '../utils/ediValidator';
import { validateEdiContent } from './geminiService';
import { StediValidationService } from './stediValidationService';

/**
 * Validation Orchestrator
 * Combines Local Regex, AI Logic, and External API validation into a single health report.
 */
export const validationOrchestrator = {
  
  async validate(
    ediContent: string, 
    options: { useAi: boolean; useStedi?: boolean; stediConfig?: any }
  ): Promise<OrchestratedResult> {
    
    const issues: ValidationIssue[] = [];
    
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

    // 2. AI Logic Validation (Context Aware)
    if (options.useAi) {
      try {
        const aiResult = await validateEdiContent(ediContent);
        if (aiResult.errors) {
          aiResult.errors.forEach(err => {
             // Avoid duplicates if possible, or just push
             issues.push({
               code: 'AI_LOGIC_ERR',
               message: err,
               severity: 'ERROR',
               source: 'AI'
             });
          });
        }
        if (aiResult.warnings) {
          aiResult.warnings.forEach(warn => {
             issues.push({
               code: 'AI_WARN',
               message: warn,
               severity: 'WARNING',
               source: 'AI'
             });
          });
        }
      } catch (e) {
        console.error("AI Validation Error", e);
      }
    }

    // 3. Stedi Validation (Strict Schema)
    if (options.useStedi && options.stediConfig?.apiKey) {
       const stediService = new StediValidationService(
           options.stediConfig.apiKey, 
           options.stediConfig.partnershipId, 
           options.stediConfig.transactionSettingId
       );
       const stediIssues = await stediService.validate(ediContent);
       issues.push(...stediIssues);
    }

    // 4. Calculate Score
    const errorCount = issues.filter(i => i.severity === 'ERROR').length;
    const warningCount = issues.filter(i => i.severity === 'WARNING').length;
    
    // Simple weighting: Start at 100. Errors -10, Warnings -2.
    let score = 100 - (errorCount * 10) - (warningCount * 2);
    score = Math.max(0, score); // Clamp to 0

    return {
      isValid: errorCount === 0,
      score,
      issues,
      metrics: {
        segmentCount: ediContent.split("'").length + ediContent.split("~").length, // Rough estimate
        errorCount,
        warningCount
      }
    };
  }
};
