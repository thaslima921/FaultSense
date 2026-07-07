import metadata from '../data/model_metadata.json';

export interface SensorData {
  air_temp: number;
  process_temp: number;
  rot_speed: number;
  torque: number;
  tool_wear: number;
}

export interface FeatureContribution {
  feature: string;
  displayName: string;
  value: number;
  contribution: number;
  unit: string;
}

export interface FailureModeDetail {
  active: boolean;
  risk: number; // 0 to 100
  description: string;
  criteria: string;
}

export interface PredictionResult {
  failure_probability: number; // 0 to 1
  health_score: number; // 0 to 100
  status: 'Normal' | 'Warning' | 'Critical';
  contributions: FeatureContribution[];
  failure_modes: {
    HDF: FailureModeDetail;
    PWF: FailureModeDetail;
    OSF: FailureModeDetail;
    TWF: FailureModeDetail;
    RNF: FailureModeDetail;
  };
}

export const FEATURE_INFO: Record<keyof SensorData, { name: string; unit: string; min: number; max: number; default: number }> = {
  air_temp: { name: 'Air Temperature', unit: 'K', min: 290, max: 310, default: 300 },
  process_temp: { name: 'Process Temperature', unit: 'K', min: 300, max: 320, default: 310 },
  rot_speed: { name: 'Rotational Speed', unit: 'rpm', min: 1000, max: 2800, default: 1500 },
  torque: { name: 'Torque', unit: 'Nm', min: 5, max: 80, default: 40 },
  tool_wear: { name: 'Tool Wear', unit: 'min', min: 0, max: 250, default: 100 },
};

export function predict(sensors: SensorData): PredictionResult {
  const { coefs, intercept, scaling } = metadata as any;

  // 1. Calculate standardized terms and feature contributions
  let z = intercept;
  const contributions: FeatureContribution[] = [];

  const keys: (keyof SensorData)[] = ['air_temp', 'process_temp', 'rot_speed', 'torque', 'tool_wear'];

  keys.forEach((key) => {
    const val = sensors[key];
    const mean = scaling[key].mean;
    const std = scaling[key].std;
    const coef = coefs[key];

    // Standardize input value
    const standardized = (val - mean) / std;
    const term = coef * standardized;
    z += term;

    contributions.push({
      feature: key,
      displayName: FEATURE_INFO[key].name,
      value: val,
      contribution: term,
      unit: FEATURE_INFO[key].unit,
    });
  });

  // Calculate overall failure probability using sigmoid function
  // Clip z to prevent overflow
  const zClipped = Math.max(-100, Math.min(100, z));
  const failure_probability = 1 / (1 + Math.exp(-zClipped));
  
  // Health score is inversely proportional to failure probability
  // but we can scale it such that normal is ~100% and high probability drops it.
  const health_score = Math.max(0, Math.min(100, Math.round((1 - failure_probability) * 100)));

  let status: 'Normal' | 'Warning' | 'Critical' = 'Normal';
  if (health_score < 70) {
    status = 'Critical';
  } else if (health_score < 90) {
    status = 'Warning';
  }

  // 2. Evaluate Specific Failure Modes
  
  // HDF: Process temp - Air temp < 8.6 K and Rotational speed < 1380 rpm
  const tempDiff = sensors.process_temp - sensors.air_temp;
  const hdfActive = tempDiff < 8.6 && sensors.rot_speed < 1380;
  // Calculate a mock risk gradient for HDF based on how close it is
  const hdfTempFactor = Math.max(0, Math.min(1, (10 - tempDiff) / 2)); // High if diff < 10
  const hdfSpeedFactor = Math.max(0, Math.min(1, (1450 - sensors.rot_speed) / 100)); // High if speed < 1450
  const hdfRisk = Math.round(hdfActive ? 100 : hdfTempFactor * hdfSpeedFactor * 90);

  // PWF: Power = Torque * speed * 2pi/60. PWF if Power < 3500 W or > 9000 W
  const power = sensors.torque * sensors.rot_speed * (2 * Math.PI / 60);
  const pwfActive = power < 3500 || power > 9000;
  let pwfRisk = 0;
  if (pwfActive) {
    pwfRisk = 100;
  } else {
    // Distance from the margins
    const riskLower = Math.max(0, Math.min(90, (1 - (power - 3500) / 1000) * 90));
    const riskUpper = Math.max(0, Math.min(90, ((power - 8000) / 1000) * 90));
    pwfRisk = Math.round(Math.max(riskLower, riskUpper));
  }

  // OSF: tool_wear * torque > 11000
  const osfProduct = sensors.tool_wear * sensors.torque;
  const osfActive = osfProduct > 11000;
  const osfRisk = Math.round(osfActive ? 100 : Math.max(0, Math.min(95, (osfProduct / 11000) * 95)));

  // TWF: tool_wear > 210
  const twfActive = sensors.tool_wear > 210;
  const twfRisk = Math.round(twfActive ? 100 : Math.max(0, Math.min(95, (sensors.tool_wear / 210) * 95)));

  // RNF: Random failure (always low risk unless triggered)
  const rnfActive = Math.random() < 0.001; // Mock RNF activation
  const rnfRisk = rnfActive ? 100 : 5;

  return {
    failure_probability,
    health_score,
    status,
    contributions,
    failure_modes: {
      HDF: {
        active: hdfActive,
        risk: hdfRisk,
        description: 'Process temperature and air temperature difference is too small under low rotational speed, resulting in poor heat dissipation.',
        criteria: 'Process - Air Temp < 8.6 K & Speed < 1380 rpm'
      },
      PWF: {
        active: pwfActive,
        risk: pwfRisk,
        description: 'Power consumption of the drive motor is outside the normal operating limits (3.5 kW to 9 kW).',
        criteria: 'Power = Torque × Speed × 2π/60 [Watts] < 3500W or > 9000W'
      },
      OSF: {
        active: osfActive,
        risk: osfRisk,
        description: 'Combination of high mechanical load (torque) and accumulated tool wear exceeds the structural limits of the cutter.',
        criteria: 'Tool Wear [min] × Torque [Nm] > 11,000 min·Nm'
      },
      TWF: {
        active: twfActive,
        risk: twfRisk,
        description: 'The cutting tool has reached its maximum safe operational life limit and requires immediate replacement.',
        criteria: 'Tool Wear > 210 min (at risk of fracture)'
      },
      RNF: {
        active: rnfActive,
        risk: rnfRisk,
        description: 'Unpredicted failure caused by unforeseen external factors, electrical surges, or minor mechanical shocks.',
        criteria: 'Random structural anomaly (0.1% baseline probability)'
      }
    }
  };
}

export function generateTimeSeries(baseData: SensorData, mode: 'normal' | 'failure_hdf' | 'failure_pwf' | 'failure_osf' | 'failure_twf', steps: number = 30): SensorData[] {
  const data: SensorData[] = [];
  let current = { ...baseData };

  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1);
    
    // Add small random noise to all
    const stepData: SensorData = {
      air_temp: current.air_temp + (Math.random() - 0.5) * 0.4,
      process_temp: current.process_temp + (Math.random() - 0.5) * 0.4,
      rot_speed: current.rot_speed + (Math.random() - 0.5) * 15,
      torque: current.torque + (Math.random() - 0.5) * 0.8,
      tool_wear: current.tool_wear + 0.5, // gradual tool wear over time
    };

    // Inject drift based on failure mode
    if (mode === 'failure_hdf') {
      // Process temp rises and air temp falls (diff decreases) and speed drops
      stepData.air_temp = baseData.air_temp - ratio * 1.5;
      stepData.process_temp = baseData.process_temp + ratio * 2.5;
      stepData.rot_speed = baseData.rot_speed - ratio * 250;
    } else if (mode === 'failure_pwf') {
      // Torque rises and speed rises (power goes above 9kW)
      stepData.torque = baseData.torque + ratio * 35;
      stepData.rot_speed = baseData.rot_speed + ratio * 800;
    } else if (mode === 'failure_osf') {
      // Torque increases rapidly, tool wear accumulates
      stepData.torque = baseData.torque + ratio * 35;
      stepData.tool_wear = baseData.tool_wear + ratio * 120;
    } else if (mode === 'failure_twf') {
      // Tool wear increases past 210
      stepData.tool_wear = baseData.tool_wear + ratio * 140;
    }

    // Keep temperatures in logical sync (Process temp should generally be higher than Air temp)
    if (stepData.process_temp <= stepData.air_temp) {
      stepData.process_temp = stepData.air_temp + 2.0;
    }

    // Clamping values to normal physical ranges
    stepData.air_temp = Math.max(285, Math.min(320, stepData.air_temp));
    stepData.process_temp = Math.max(295, Math.min(330, stepData.process_temp));
    stepData.rot_speed = Math.max(800, Math.min(3000, stepData.rot_speed));
    stepData.torque = Math.max(2, Math.min(95, stepData.torque));
    stepData.tool_wear = Math.max(0, Math.min(260, stepData.tool_wear));

    data.push(stepData);
    current = stepData;
  }

  return data;
}
