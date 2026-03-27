import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Synthetic forecast data generator
 * In production: Prophet time series model (Python ML service)
 */
function generateForecastData(months: number, baseArr: number) {
  const forecast: any[] = [];
  let currentArr = baseArr;

  for (let i = 0; i < months; i++) {
    const monthDate = new Date();
    monthDate.setMonth(monthDate.getMonth() + i);

    // Simulate growth with some variance
    const growthRate = 0.02 + (Math.random() * 0.03); // 2-5% growth
    const churnRate = 0.01 + (Math.random() * 0.015); // 1-2.5% churn
    const expansion = currentArr * growthRate;
    const churn = currentArr * churnRate;
    const contraction = currentArr * (Math.random() * 0.005);
    const newBusiness = baseArr * (0.01 + Math.random() * 0.02);

    currentArr = currentArr + expansion + newBusiness - churn - contraction;

    const confidenceWidth = currentArr * (0.05 + i * 0.01); // wider CI for further months

    forecast.push({
      month: monthDate.toISOString().slice(0, 7),
      arr: Math.round(currentArr),
      mrr: Math.round(currentArr / 12),
      expansion: Math.round(expansion),
      contraction: Math.round(contraction),
      churn: Math.round(churn),
      new_business: Math.round(newBusiness),
      confidence_lower: Math.round(currentArr - confidenceWidth),
      confidence_upper: Math.round(currentArr + confidenceWidth),
    });
  }
  return forecast;
}

// GET /api/forecast/mrr - MRR forecast with confidence intervals
router.get('/mrr', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const months = parseInt(req.query.months as string) || 12;
    const baseArr = 2500000; // Would come from real ARR aggregation

    const forecast = generateForecastData(months, baseArr);

    res.json({
      status: 'success',
      data: {
        org_id: orgId,
        generated_at: new Date().toISOString(),
        model: 'prophet_v1',
        base_arr: baseArr,
        forecast_months: months,
        forecast,
        summary: {
          starting_arr: baseArr,
          ending_arr_forecast: forecast[forecast.length - 1]?.arr || baseArr,
          total_expected_expansion: forecast.reduce((s, f) => s + f.expansion, 0),
          total_expected_churn: forecast.reduce((s, f) => s + f.churn, 0),
          total_expected_new: forecast.reduce((s, f) => s + f.new_business, 0),
          net_arr_change: (forecast[forecast.length - 1]?.arr || baseArr) - baseArr,
        }
      }
    });
  } catch (error) {
    logger.error('Error generating MRR forecast:', error);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

// POST /api/forecast/scenario - Scenario modeling
router.post('/scenario', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    const {
      save_percentage = 50,       // % of high-risk accounts saved
      expansion_boost = 0,        // additional expansion percentage
      churn_reduction = 0,        // churn reduction percentage
      months = 12
    } = req.body;

    const baseArr = 2500000;
    const atRiskArr = 450000;     // Sum of high-risk account ARR
    const highRiskCount = 12;

    // Base scenario
    const baseForecast = generateForecastData(months, baseArr);

    // Adjusted scenario
    const savedArr = atRiskArr * (save_percentage / 100);
    const adjustedBase = baseArr + savedArr * 0.5; // partial recovery
    const adjustedForecast = generateForecastData(months, adjustedBase);

    res.json({
      status: 'success',
      data: {
        scenario_input: { save_percentage, expansion_boost, churn_reduction, months },
        base_scenario: {
          ending_arr: baseForecast[baseForecast.length - 1]?.arr,
          forecast: baseForecast,
        },
        adjusted_scenario: {
          ending_arr: adjustedForecast[adjustedForecast.length - 1]?.arr,
          forecast: adjustedForecast,
          arr_impact: (adjustedForecast[adjustedForecast.length - 1]?.arr || 0) -
                      (baseForecast[baseForecast.length - 1]?.arr || 0),
          accounts_saved: Math.round(highRiskCount * (save_percentage / 100)),
          arr_saved: Math.round(savedArr),
        },
        waterfall: {
          starting_arr: baseArr,
          at_risk_arr: atRiskArr,
          expected_churn: Math.round(atRiskArr * (1 - save_percentage / 100)),
          expected_save: Math.round(savedArr),
          expected_expansion: Math.round(baseArr * 0.08 * (1 + expansion_boost / 100)),
          expected_new_business: Math.round(baseArr * 0.05),
          forecasted_arr: adjustedForecast[adjustedForecast.length - 1]?.arr,
        }
      }
    });
  } catch (error) {
    logger.error('Error computing scenario:', error);
    res.status(500).json({ error: 'Failed to compute scenario' });
  }
});

// GET /api/forecast/accuracy - Forecast accuracy (MAPE)
router.get('/accuracy', async (req: Request, res: Response) => {
  try {
    // Simulated historical forecast vs actual comparison
    res.json({
      status: 'success',
      data: {
        mape: 8.3,   // Mean Absolute Percentage Error
        periods: [
          { month: '2025-12', forecast_mrr: 198000, actual_mrr: 195500, error_pct: 1.3 },
          { month: '2026-01', forecast_mrr: 202000, actual_mrr: 208000, error_pct: 2.9 },
          { month: '2026-02', forecast_mrr: 205000, actual_mrr: 208333, error_pct: 1.6 },
        ]
      }
    });
  } catch (error) {
    logger.error('Error fetching forecast accuracy:', error);
    res.status(500).json({ error: 'Failed to fetch forecast accuracy' });
  }
});

export default router;
