import { AccountMetricsData } from '../models/AccountMetrics';
import { logger } from '../utils/logger';

export interface OrgWeights {
  engagement: number;
  utilization: number;
  support: number;
  financial: number;
  relationship: number;
}

export interface ScoreBreakdown {
  total: number;
  engagement: number;
  utilization: number;
  support: number;
  financial: number;
  relationship: number;
  trend: number;
  risk_tier: 'healthy' | 'at_risk' | 'high_risk' | 'churned';
}

const DEFAULT_WEIGHTS: OrgWeights = {
  engagement: 0.30,
  utilization: 0.20,
  support: 0.15,
  financial: 0.20,
  relationship: 0.15,
};

export class HealthScoreEngine {
  private weights: OrgWeights;

  constructor(weights?: Partial<OrgWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /**
   * Calculate composite health score from account metrics
   */
  calculate(metrics: AccountMetricsData): ScoreBreakdown {
    const engagement = this.scoreEngagement(metrics);
    const utilization = this.scoreUtilization(metrics);
    const support = this.scoreSupport(metrics);
    const financial = this.scoreFinancial(metrics);
    const relationship = this.scoreRelationship(metrics);

    const total = Math.round(
      engagement * this.weights.engagement +
      utilization * this.weights.utilization +
      support * this.weights.support +
      financial * this.weights.financial +
      relationship * this.weights.relationship
    );

    const clampedTotal = Math.max(0, Math.min(100, total));

    return {
      total: clampedTotal,
      engagement: Math.round(engagement),
      utilization: Math.round(utilization),
      support: Math.round(support),
      financial: Math.round(financial),
      relationship: Math.round(relationship),
      trend: 0, // calculated separately from history
      risk_tier: this.getRiskTier(clampedTotal),
    };
  }

  /**
   * Product Engagement: DAU/MAU ratio, sessions/week, feature breadth
   */
  private scoreEngagement(metrics: AccountMetricsData): number {
    const dauMauRatio = metrics.mau_30d > 0
      ? (metrics.dau_7d / 7) / (metrics.mau_30d / 30)
      : 0;

    // DAU/MAU > 0.4 is excellent, < 0.1 is poor
    const dauMauScore = Math.min(100, (dauMauRatio / 0.4) * 100);

    // Sessions per week: > 20 is excellent, < 3 is poor
    const sessionScore = Math.min(100, (metrics.sessions_7d / 20) * 100);

    // Feature adoption: % of features used
    const features = metrics.feature_adoption || {};
    const featureValues = Object.values(features);
    const avgAdoption = featureValues.length > 0
      ? featureValues.reduce((a, b) => a + b, 0) / featureValues.length
      : 0;
    const featureScore = Math.min(100, avgAdoption);

    // Days since login penalty
    const loginPenalty = metrics.days_since_login > 14 ? -20 :
                         metrics.days_since_login > 7 ? -10 :
                         metrics.days_since_login > 3 ? -5 : 0;

    return Math.max(0, (dauMauScore * 0.35 + sessionScore * 0.35 + featureScore * 0.30) + loginPenalty);
  }

  /**
   * Seat Utilization: active_seats / licensed_seats
   */
  private scoreUtilization(metrics: AccountMetricsData): number {
    if (metrics.licensed_seats === 0) return 50; // unknown

    const utilization = metrics.seat_utilization ||
      (metrics.active_seats / metrics.licensed_seats * 100);

    // >80% is excellent, <40% is critical
    if (utilization >= 80) return 100;
    if (utilization >= 60) return 75;
    if (utilization >= 40) return 50;
    if (utilization >= 20) return 25;
    return 10;
  }

  /**
   * Support Health: ticket volume, CSAT, unresolved tickets
   */
  private scoreSupport(metrics: AccountMetricsData): number {
    // Low tickets + high CSAT = healthy
    const ticketScore = metrics.support_tickets_30d <= 2 ? 100 :
                        metrics.support_tickets_30d <= 5 ? 80 :
                        metrics.support_tickets_30d <= 10 ? 60 :
                        metrics.support_tickets_30d <= 20 ? 40 : 20;

    // CSAT: 5 scale, >4.0 is great, <3.0 is poor
    const csatScore = metrics.avg_csat_90d >= 4.5 ? 100 :
                      metrics.avg_csat_90d >= 4.0 ? 85 :
                      metrics.avg_csat_90d >= 3.5 ? 70 :
                      metrics.avg_csat_90d >= 3.0 ? 50 :
                      metrics.avg_csat_90d >= 2.0 ? 30 : 15;

    return ticketScore * 0.5 + csatScore * 0.5;
  }

  /**
   * Financial Health: payment failures, days to renewal
   */
  private scoreFinancial(metrics: AccountMetricsData): number {
    // Payment failures: 0 is perfect, >3 is critical
    const paymentScore = metrics.payment_failures_90d === 0 ? 100 :
                         metrics.payment_failures_90d === 1 ? 70 :
                         metrics.payment_failures_90d === 2 ? 50 :
                         metrics.payment_failures_90d <= 4 ? 30 : 10;

    // Renewal proximity: closer = more important to monitor
    const renewalScore = metrics.days_to_renewal > 180 ? 90 :
                         metrics.days_to_renewal > 90 ? 80 :
                         metrics.days_to_renewal > 60 ? 70 :
                         metrics.days_to_renewal > 30 ? 60 :
                         metrics.days_to_renewal > 14 ? 50 : 40;

    return paymentScore * 0.6 + renewalScore * 0.4;
  }

  /**
   * Relationship Health: CS touchpoints, engagement signals
   */
  private scoreRelationship(metrics: AccountMetricsData): number {
    // Days since last CS touchpoint
    if (metrics.days_since_cs_touchpoint <= 7) return 100;
    if (metrics.days_since_cs_touchpoint <= 14) return 85;
    if (metrics.days_since_cs_touchpoint <= 30) return 70;
    if (metrics.days_since_cs_touchpoint <= 60) return 50;
    if (metrics.days_since_cs_touchpoint <= 90) return 30;
    return 15;
  }

  private getRiskTier(score: number): 'healthy' | 'at_risk' | 'high_risk' | 'churned' {
    if (score >= 75) return 'healthy';
    if (score >= 50) return 'at_risk';
    if (score >= 25) return 'high_risk';
    return 'churned';
  }

  /**
   * Generate next-best-action recommendations based on score breakdown
   */
  static getRecommendations(breakdown: ScoreBreakdown): string[] {
    const actions: string[] = [];

    if (breakdown.engagement < 50) {
      actions.push('Schedule a product training session to boost engagement');
    }
    if (breakdown.utilization < 50) {
      actions.push('Discuss seat optimization — utilization is below 50%');
    }
    if (breakdown.support < 50) {
      actions.push('Review open support tickets — CSAT or volume is concerning');
    }
    if (breakdown.financial < 50) {
      actions.push('Address payment failures and review billing configuration');
    }
    if (breakdown.relationship < 50) {
      actions.push('Schedule an Executive Business Review (EBR)');
    }
    if (breakdown.total < 40) {
      actions.push('Escalate to Account Executive — high churn risk');
    }
    if (actions.length === 0) {
      actions.push('Account is healthy — consider expansion opportunities');
    }

    return actions;
  }
}
