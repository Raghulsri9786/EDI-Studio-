
import { TPRule, ValidationIssue, ParsedLine } from '../types';
import { parseEdiToLines } from '../utils/ediParser';

/**
 * Rules Engine
 * Executes configured Trading Partner Rules against parsed EDI content.
 */
export const rulesEngine = {
  
  validate(content: string, rules: TPRule[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const lines = parseEdiToLines(content);
    
    // Map lines for easy lookup
    const segmentsById: Record<string, ParsedLine[]> = {};
    lines.forEach(line => {
        if (!segmentsById[line.segmentId]) segmentsById[line.segmentId] = [];
        segmentsById[line.segmentId].push(line);
    });

    rules.forEach(rule => {
        switch (rule.type) {
            case 'REQUIRED_SEGMENT':
                if (!segmentsById[rule.targetSegment]) {
                    issues.push({
                        code: 'TP_MISSING_SEG',
                        message: rule.message || `Missing required segment: ${rule.targetSegment}`,
                        severity: rule.severity,
                        source: 'TP_RULE',
                        segmentId: rule.targetSegment
                    });
                }
                break;

            case 'PROHIBITED_SEGMENT':
                if (segmentsById[rule.targetSegment]) {
                    segmentsById[rule.targetSegment].forEach(line => {
                        issues.push({
                            code: 'TP_FORBIDDEN_SEG',
                            message: rule.message || `Segment ${rule.targetSegment} is prohibited by TP rules.`,
                            severity: rule.severity,
                            line: line.lineNumber,
                            source: 'TP_RULE',
                            segmentId: rule.targetSegment
                        });
                    });
                }
                break;

            case 'MAX_LENGTH':
                if (segmentsById[rule.targetSegment] && rule.targetElement && rule.params?.length) {
                    segmentsById[rule.targetSegment].forEach(line => {
                        const token = line.tokens.find(t => t.index === rule.targetElement);
                        if (token && token.value.length > rule.params.length) {
                            issues.push({
                                code: 'TP_LEN_ERR',
                                message: rule.message || `${rule.targetSegment}${rule.targetElement} exceeds max length of ${rule.params.length}`,
                                severity: rule.severity,
                                line: line.lineNumber,
                                source: 'TP_RULE',
                                segmentId: rule.targetSegment,
                                elementId: `${rule.targetSegment}${rule.targetElement}`
                            });
                        }
                    });
                }
                break;

            case 'ALLOWED_CODES':
                if (segmentsById[rule.targetSegment] && rule.targetElement && rule.params?.codes) {
                    const allowed = new Set(rule.params.codes);
                    segmentsById[rule.targetSegment].forEach(line => {
                        const token = line.tokens.find(t => t.index === rule.targetElement);
                        if (token && !allowed.has(token.value)) {
                            issues.push({
                                code: 'TP_INVALID_CODE',
                                message: rule.message || `Invalid code '${token.value}' in ${rule.targetSegment}${rule.targetElement}. Allowed: ${rule.params.codes.join(', ')}`,
                                severity: rule.severity,
                                line: line.lineNumber,
                                source: 'TP_RULE',
                                segmentId: rule.targetSegment,
                                elementId: `${rule.targetSegment}${rule.targetElement}`
                            });
                        }
                    });
                }
                break;

            case 'CONDITIONAL_EXISTS':
                // If Target Exists, Param Segment Must Exist
                if (segmentsById[rule.targetSegment] && rule.params?.dependentSegment) {
                    if (!segmentsById[rule.params.dependentSegment]) {
                        issues.push({
                            code: 'TP_CONDITIONAL',
                            message: rule.message || `If ${rule.targetSegment} exists, ${rule.params.dependentSegment} is required.`,
                            severity: rule.severity,
                            source: 'TP_RULE',
                            segmentId: rule.targetSegment
                        });
                    }
                }
                break;
        }
    });

    return issues;
  }
};
