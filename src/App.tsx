import { useState, useMemo } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Wrench, 
  ShieldAlert, 
  DollarSign, 
  Database, 
  Users, 
  BarChart2, 
  Sliders, 
  Clipboard, 
  Info, 
  Check 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';
import { predict, generateTimeSeries, FEATURE_INFO } from './utils/predictor';
import type { SensorData, PredictionResult } from './utils/predictor';
import metadata from './data/model_metadata.json';

// Define Interface types
interface Asset {
  id: string;
  name: string;
  type: string;
  baseSensors: SensorData;
  sensors: SensorData;
  lastUpdated: string;
}

interface WorkOrder {
  id: string;
  assetId: string;
  assetName: string;
  failureMode: string;
  priority: 'high' | 'medium' | 'low';
  status: 'Pending' | 'Completed';
  createdAt: string;
}

// Initial Assets
const INITIAL_ASSETS: Asset[] = [
  {
    id: 'ASSET-01',
    name: 'Motor #1',
    type: 'Drive Motor',
    baseSensors: { air_temp: 298.5, process_temp: 308.2, rot_speed: 1520, torque: 38.5, tool_wear: 15 },
    sensors: { air_temp: 298.5, process_temp: 308.2, rot_speed: 1520, torque: 38.5, tool_wear: 15 },
    lastUpdated: 'Just now'
  },
  {
    id: 'ASSET-02',
    name: 'Bearing #4',
    type: 'Main Roller Bearing',
    baseSensors: { air_temp: 297.8, process_temp: 307.9, rot_speed: 1480, torque: 42.0, tool_wear: 120 },
    sensors: { air_temp: 297.8, process_temp: 307.9, rot_speed: 1480, torque: 42.0, tool_wear: 120 },
    lastUpdated: '2 mins ago'
  },
  {
    id: 'ASSET-03',
    name: 'Conveyor #2',
    type: 'Belt Conveyor System',
    baseSensors: { air_temp: 300.1, process_temp: 310.5, rot_speed: 1350, torque: 48.0, tool_wear: 45 },
    sensors: { air_temp: 300.1, process_temp: 310.5, rot_speed: 1350, torque: 48.0, tool_wear: 45 },
    lastUpdated: '10 mins ago'
  },
  {
    id: 'ASSET-04',
    name: 'Compressor #3',
    type: 'Reciprocating Compressor',
    baseSensors: { air_temp: 299.0, process_temp: 309.2, rot_speed: 1650, torque: 32.0, tool_wear: 85 },
    sensors: { air_temp: 299.0, process_temp: 309.2, rot_speed: 1650, torque: 32.0, tool_wear: 85 },
    lastUpdated: '5 mins ago'
  },
  {
    id: 'ASSET-05',
    name: 'Robot Joint #5',
    type: 'Articulated Manipulator Joint',
    baseSensors: { air_temp: 301.2, process_temp: 311.8, rot_speed: 1800, torque: 28.0, tool_wear: 195 },
    sensors: { air_temp: 301.2, process_temp: 311.8, rot_speed: 1800, torque: 28.0, tool_wear: 195 },
    lastUpdated: 'Just now'
  },
  {
    id: 'ASSET-06',
    name: 'Hydraulic Pump #6',
    type: 'Gear Pump Assembly',
    baseSensors: { air_temp: 299.5, process_temp: 309.9, rot_speed: 1420, torque: 52.0, tool_wear: 60 },
    sensors: { air_temp: 299.5, process_temp: 309.9, rot_speed: 1420, torque: 52.0, tool_wear: 60 },
    lastUpdated: '12 mins ago'
  }
];

export default function App() {
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('ASSET-01');
  const [activeRole, setActiveRole] = useState<'manager' | 'technician' | 'engineer'>('engineer');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [chartMode, setChartMode] = useState<'normal' | 'failure_hdf' | 'failure_pwf' | 'failure_osf' | 'failure_twf'>('normal');

  // Find the selected asset object
  const selectedAsset = useMemo(() => {
    return assets.find(a => a.id === selectedAssetId) || assets[0];
  }, [assets, selectedAssetId]);

  // Compute prediction results for all assets for overview panel
  const assetPredictions = useMemo(() => {
    const preds: Record<string, PredictionResult> = {};
    assets.forEach(a => {
      preds[a.id] = predict(a.sensors);
    });
    return preds;
  }, [assets]);

  // Compute prediction results for the selected asset
  const selectedPrediction = useMemo(() => {
    return predict(selectedAsset.sensors);
  }, [selectedAsset]);

  // Generate simulated time-series data based on current sensors and chart mode
  const timeSeriesData = useMemo(() => {
    const series = generateTimeSeries(selectedAsset.sensors, chartMode, 30);
    return series.map((dataPoint, idx) => {
      const pred = predict(dataPoint);
      return {
        step: idx + 1,
        'Air Temp (K)': parseFloat(dataPoint.air_temp.toFixed(1)),
        'Process Temp (K)': parseFloat(dataPoint.process_temp.toFixed(1)),
        'Rotational Speed (rpm)': Math.round(dataPoint.rot_speed),
        'Torque (Nm)': parseFloat(dataPoint.torque.toFixed(1)),
        'Tool Wear (min)': parseFloat(dataPoint.tool_wear.toFixed(1)),
        'Failure Risk (%)': parseFloat((pred.failure_probability * 100).toFixed(1))
      };
    });
  }, [selectedAsset.sensors, chartMode]);

  // Update slider value for the selected asset
  const handleSliderChange = (key: keyof SensorData, value: number) => {
    setAssets(prev => prev.map(a => {
      if (a.id === selectedAssetId) {
        return {
          ...a,
          sensors: {
            ...a.sensors,
            [key]: value
          },
          lastUpdated: 'Just now'
        };
      }
      return a;
    }));
  };

  // Preset Failure Modes Injection
  const loadPreset = (mode: 'normal' | 'hdf' | 'pwf' | 'osf' | 'twf') => {
    setAssets(prev => prev.map(a => {
      if (a.id === selectedAssetId) {
        let overriddenSensors = { ...a.baseSensors };
        if (mode === 'hdf') {
          // dT < 8.6, rot_speed < 1380
          overriddenSensors = {
            air_temp: 301.5,
            process_temp: 309.5, // dT = 8.0
            rot_speed: 1250,
            torque: 48.0,
            tool_wear: a.baseSensors.tool_wear
          };
          setChartMode('failure_hdf');
        } else if (mode === 'pwf') {
          // power = torque * speed * 2pi/60. > 9000 or < 3500
          overriddenSensors = {
            air_temp: a.baseSensors.air_temp,
            process_temp: a.baseSensors.process_temp,
            rot_speed: 2600,
            torque: 60.0, // Power = 60 * 2600 * 0.1047 = 16,332 W (> 9000W)
            tool_wear: a.baseSensors.tool_wear
          };
          setChartMode('failure_pwf');
        } else if (mode === 'osf') {
          // tool_wear * torque > 11000
          overriddenSensors = {
            air_temp: a.baseSensors.air_temp,
            process_temp: a.baseSensors.process_temp,
            rot_speed: 1300,
            torque: 72.0,
            tool_wear: 180.0 // product = 12960 (> 11000)
          };
          setChartMode('failure_osf');
        } else if (mode === 'twf') {
          // tool wear > 210
          overriddenSensors = {
            ...a.baseSensors,
            tool_wear: 235.0
          };
          setChartMode('failure_twf');
        } else {
          setChartMode('normal');
        }
        return {
          ...a,
          sensors: overriddenSensors,
          lastUpdated: 'Just now'
        };
      }
      return a;
    }));
  };

  // Create Work Order for current critical asset
  const handleCreateWorkOrder = () => {
    // Find active failure mode if any
    let failureModeName = 'General Diagnostics';
    let priority: 'high' | 'medium' | 'low' = 'low';
    
    const fm = selectedPrediction.failure_modes;
    if (fm.HDF.active || fm.HDF.risk > 80) {
      failureModeName = 'Heat Dissipation Failure';
      priority = 'high';
    } else if (fm.PWF.active || fm.PWF.risk > 80) {
      failureModeName = 'Power Out-of-Bounds';
      priority = 'high';
    } else if (fm.OSF.active || fm.OSF.risk > 80) {
      failureModeName = 'Mechanical Overstrain';
      priority = 'high';
    } else if (fm.TWF.active || fm.TWF.risk > 80) {
      failureModeName = 'Tool Wear Replacement';
      priority = 'medium';
    } else if (selectedPrediction.status === 'Warning') {
      priority = 'medium';
    }

    // Check if work order already exists for this asset
    if (workOrders.some(wo => wo.assetId === selectedAssetId && wo.status === 'Pending')) {
      alert('A pending work order already exists for this asset.');
      return;
    }

    const newWO: WorkOrder = {
      id: `WO-${Math.floor(1000 + Math.random() * 9000)}`,
      assetId: selectedAssetId,
      assetName: selectedAsset.name,
      failureMode: failureModeName,
      priority,
      status: 'Pending',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setWorkOrders(prev => [newWO, ...prev]);
  };

  // Complete Work Order (from Tech View)
  const handleResolveWorkOrder = (id: string, assetId: string) => {
    // Reset asset sensors to base
    setAssets(prev => prev.map(a => {
      if (a.id === assetId) {
        return {
          ...a,
          sensors: { ...a.baseSensors },
          lastUpdated: 'Just now'
        };
      }
      return a;
    }));

    // Mark work order completed
    setWorkOrders(prev => prev.map(wo => {
      if (wo.id === id) {
        return { ...wo, status: 'Completed' as const };
      }
      return wo;
    }));

    setChartMode('normal');
  };

  // Calculations for Reliability Engineer Metrics
  const failureModeDistData = useMemo(() => {
    const summary = metadata.dataset_summary.failure_types;
    return [
      { name: 'Tool Wear (TWF)', value: summary.TWF },
      { name: 'Heat Dissipation (HDF)', value: summary.HDF },
      { name: 'Power Failure (PWF)', value: summary.PWF },
      { name: 'Overstrain (OSF)', value: summary.OSF },
      { name: 'Random (RNF)', value: summary.RNF },
    ];
  }, []);

  // Compute stats for Manager Dashboard
  const managerStats = useMemo(() => {
    // Average health score across all 6 assets
    const totalHealth = Object.values(assetPredictions).reduce((sum, p) => sum + p.health_score, 0);
    const avgHealth = Math.round(totalHealth / assets.length);
    
    // OEE (correlated to average health)
    const oee = parseFloat((avgHealth * 0.9 + 5).toFixed(1));
    
    // Count active issues
    const warningCount = Object.values(assetPredictions).filter(p => p.status === 'Warning').length;
    const criticalCount = Object.values(assetPredictions).filter(p => p.status === 'Critical').length;
    
    // Estimated Downtime Cost
    const downtimeCost = criticalCount * 12500 + warningCount * 2500;
    
    return {
      avgHealth,
      oee,
      warningCount,
      criticalCount,
      downtimeCost
    };
  }, [assets, assetPredictions]);

  // Model Coefficients list
  const modelCoeffs = useMemo(() => {
    const c = metadata.coefs;
    return [
      { feature: 'Air Temperature', val: c.air_temp, color: '#3b82f6' },
      { feature: 'Process Temperature', val: c.process_temp, color: '#10b981' },
      { feature: 'Rotational Speed', val: c.rot_speed, color: '#f59e0b' },
      { feature: 'Torque', val: c.torque, color: '#6366f1' },
      { feature: 'Tool Wear', val: c.tool_wear, color: '#ef4444' },
    ].sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
  }, []);

  return (
    <div className="app-container">
      <div className="grid-overlay" />
      
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Activity className="logo-icon" size={26} />
          <span className="logo-text">FAULTSENSE</span>
        </div>
        
        <div className="sidebar-menu">
          <button 
            className={`menu-item ${activeRole === 'engineer' ? 'active' : ''}`}
            onClick={() => setActiveRole('engineer')}
          >
            <Database size={18} />
            <span>Reliability Eng</span>
          </button>
          
          <button 
            className={`menu-item ${activeRole === 'technician' ? 'active' : ''}`}
            onClick={() => setActiveRole('technician')}
          >
            <Wrench size={18} />
            <span>Field Technician</span>
          </button>
          
          <button 
            className={`menu-item ${activeRole === 'manager' ? 'active' : ''}`}
            onClick={() => setActiveRole('manager')}
          >
            <Users size={18} />
            <span>Plant Manager</span>
          </button>
        </div>
        
        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">
              {activeRole === 'engineer' ? 'RE' : activeRole === 'technician' ? 'FT' : 'PM'}
            </div>
            <div className="user-info">
              <span className="user-name">
                {activeRole === 'engineer' ? 'Alex Rivera' : activeRole === 'technician' ? 'Marcus Vance' : 'Helen Cho'}
              </span>
              <span className="user-role">
                {activeRole === 'engineer' ? 'Reliability Eng.' : activeRole === 'technician' ? 'Technician' : 'Operations Mgr.'}
              </span>
            </div>
          </div>
        </div>
      </aside>
      
      {/* Main dashboard view */}
      <main className="main-content">
        <header className="dashboard-header">
          <div className="dashboard-title">
            <h1>Predictive Analytics Portal</h1>
            <p className="dashboard-subtitle">Edge-AI Vehicle Assembly Line Diagnostics Dashboard</p>
          </div>
          <div className="dashboard-actions">
            <span className="live-status">
              <span className="live-dot" />
              <span>LIVE EDGE FEED</span>
            </span>
          </div>
        </header>

        {/* OVERVIEW PANEL - ASSETS GRID */}
        <section className="overview-panel">
          <h2 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '16px', letterSpacing: '0.5px' }}>
            SYSTEM ASSET HEALTH SUMMARY
          </h2>
          <div className="overview-grid">
            {assets.map((asset) => {
              const pred = assetPredictions[asset.id];
              const statusClass = pred.status.toLowerCase();
              const isSelected = asset.id === selectedAssetId;
              
              return (
                <div 
                  key={asset.id} 
                  className={`card asset-card ${statusClass} ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedAssetId(asset.id)}
                >
                  <div className="asset-card-header">
                    <div>
                      <span className="asset-name">{asset.name}</span>
                      <p className="asset-type">{asset.type}</p>
                    </div>
                    <span className={`health-badge ${statusClass}`}>
                      {pred.health_score}%
                    </span>
                  </div>
                  
                  <div className="asset-metrics-summary">
                    <div className="metric-mini-item">
                      <span className="metric-mini-label">Temp</span>
                      <span className="metric-mini-value">{asset.sensors.process_temp.toFixed(1)}K</span>
                    </div>
                    <div className="metric-mini-item">
                      <span className="metric-mini-label">Speed</span>
                      <span className="metric-mini-value">{Math.round(asset.sensors.rot_speed)} rpm</span>
                    </div>
                    <div className="metric-mini-item">
                      <span className="metric-mini-label">Torque</span>
                      <span className="metric-mini-value">{asset.sensors.torque.toFixed(1)}Nm</span>
                    </div>
                  </div>
                  
                  <div className="asset-card-footer">
                    <span>{asset.id}</span>
                    <span>{asset.lastUpdated}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Dynamic Details based on active user Role Tab */}
        {activeRole === 'engineer' && (
          <div className="dashboard-details-layout">
            
            {/* COLUMN 1: SENSOR TUNING AND CHART TIME SERIES */}
            <div className="prediction-panel">
              
              {/* Card 1: Sensor Overrides (Live Simulator) */}
              <div className="card">
                <div className="card-title">
                  <Sliders size={16} />
                  <span>SIMULATE REAL-TIME ANOMALIES ({selectedAsset.name})</span>
                </div>
                
                {/* Sliders Panel */}
                <div className="sliders-grid">
                  {(Object.keys(FEATURE_INFO) as (keyof SensorData)[]).map((key) => {
                    const info = FEATURE_INFO[key];
                    const val = selectedAsset.sensors[key];
                    return (
                      <div className="slider-group" key={key}>
                        <div className="slider-label-row">
                          <span className="slider-label">{info.name}</span>
                          <span className="slider-val">
                            {val.toFixed(1)} {info.unit}
                          </span>
                        </div>
                        <input 
                          type="range"
                          className="industrial-slider"
                          min={info.min}
                          max={info.max}
                          step={key === 'rot_speed' ? 10 : 0.5}
                          value={val}
                          onChange={(e) => handleSliderChange(key, parseFloat(e.target.value))}
                        />
                        <div className="slider-range-labels">
                          <span>{info.min}{info.unit}</span>
                          <span>{info.max}{info.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Preset Failure Injections */}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                    DEMO PRESETS: Inject typical failure signatures into this asset
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button className="btn btn-secondary" onClick={() => loadPreset('normal')} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                      Reset Normal
                    </button>
                    <button className="btn btn-secondary" onClick={() => loadPreset('hdf')} style={{ fontSize: '0.75rem', padding: '6px 12px', borderLeftColor: 'var(--color-critical)' }}>
                      Heat Dissipation (HDF)
                    </button>
                    <button className="btn btn-secondary" onClick={() => loadPreset('pwf')} style={{ fontSize: '0.75rem', padding: '6px 12px', borderLeftColor: 'var(--color-critical)' }}>
                      Power Limits (PWF)
                    </button>
                    <button className="btn btn-secondary" onClick={() => loadPreset('osf')} style={{ fontSize: '0.75rem', padding: '6px 12px', borderLeftColor: 'var(--color-critical)' }}>
                      Overstrain Failure (OSF)
                    </button>
                    <button className="btn btn-secondary" onClick={() => loadPreset('twf')} style={{ fontSize: '0.75rem', padding: '6px 12px', borderLeftColor: 'var(--color-critical)' }}>
                      Tool Wear Limit (TWF)
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Prediction time series chart */}
              <div className="card">
                <div className="card-title">
                  <TrendingUp size={16} />
                  <span>PREDICTION RUNTIME PROFILES & SENSOR DATA TRENDS</span>
                </div>
                <div style={{ height: '300px', width: '100%', marginTop: '10px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="step" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                      <YAxis yAxisId="left" stroke="var(--color-primary)" fontSize={11} tickLine={false} label={{ value: 'Sensors / Temps', angle: -90, position: 'insideLeft', fill: 'var(--color-primary)', fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="var(--color-critical)" fontSize={11} tickLine={false} label={{ value: 'Failure Probability %', angle: 90, position: 'insideRight', fill: 'var(--color-critical)', fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ background: '#111827', borderColor: 'var(--border-color)', borderRadius: '8px', color: '#fff' }}
                        labelFormatter={(label) => `Time step: ${label}`}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                      <Line yAxisId="left" type="monotone" dataKey="Torque (Nm)" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                      <Line yAxisId="left" type="monotone" dataKey="Tool Wear (min)" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                      <Line yAxisId="left" type="monotone" dataKey="Rotational Speed (rpm)" stroke="#f59e0b" strokeWidth={1} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="Failure Risk (%)" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6 }} strokeDasharray="3 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Remaining Useful Life (RUL) Estimate: </span>
                  <strong style={{ 
                    fontFamily: 'var(--font-display)', 
                    fontSize: '1rem', 
                    color: selectedPrediction.health_score < 70 ? 'var(--color-critical)' : selectedPrediction.health_score < 90 ? 'var(--color-warning)' : 'var(--color-success)'
                  }}>
                    {selectedPrediction.health_score < 10 
                      ? 'DANGER: Immediate Failure Imminent' 
                      : `${Math.max(1, Math.round(selectedPrediction.health_score * 0.4))} Operational Days Remaining`}
                  </strong>
                </div>
              </div>

              {/* Card 3: Model Metrics & Feature Weights */}
              <div className="card">
                <div className="card-title">
                  <Database size={16} />
                  <span>LOGISTIC REGRESSION MODEL INSIGHTS (UCI AI4I 2020 PRE-TRAINED)</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Features are normalized using training statistics. Model weights demonstrate influence magnitude:
                </p>
                <div className="engineer-charts-grid">
                  <div>
                    <h4 style={{ fontSize: '0.8rem', marginBottom: '10px', color: '#fff' }}>Model Coefficients (Influence Magnitude)</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {modelCoeffs.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{item.feature}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '80px', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ 
                                height: '100%', 
                                background: item.val > 0 ? 'var(--color-critical)' : 'var(--color-success)',
                                width: `${Math.min(100, (Math.abs(item.val) / 1.5) * 100)}%`,
                                marginLeft: item.val < 0 ? 'auto' : '0'
                              }} />
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.val > 0 ? '+' : ''}{item.val.toFixed(4)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.8rem', marginBottom: '10px', color: '#fff' }}>Failure Modes Distribution in Training Set</h4>
                    <div style={{ height: '120px', width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={failureModeDistData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="name" fontSize={8} stroke="var(--text-muted)" tickLine={false} tickFormatter={(name) => name.split(' ')[0]} />
                          <YAxis fontSize={8} stroke="var(--text-muted)" tickLine={false} />
                          <Tooltip contentStyle={{ background: '#111827', fontSize: 10, borderColor: 'var(--border-color)' }} />
                          <Bar dataKey="value" fill="var(--color-accent)">
                            {failureModeDistData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : index === 1 ? '#f59e0b' : '#3b82f6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* COLUMN 2: ROOT CAUSE EXPLANATIONS & ACTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Card 1: Risk Meter */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="card-title">
                  <ShieldAlert size={16} />
                  <span>EDGE-AI REALTIME RISK PREDICTOR</span>
                </div>
                
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <span style={{ 
                    fontFamily: 'var(--font-display)', 
                    fontSize: '3.2rem', 
                    fontWeight: 900,
                    lineHeight: '1',
                    color: selectedPrediction.health_score < 70 ? 'var(--color-critical)' : selectedPrediction.health_score < 90 ? 'var(--color-warning)' : 'var(--color-success)',
                    textShadow: `0 0 20px ${selectedPrediction.health_score < 70 ? 'var(--color-critical-glow)' : selectedPrediction.health_score < 90 ? 'var(--color-warning-glow)' : 'var(--color-success-glow)'}`
                  }}>
                    {Math.round(selectedPrediction.failure_probability * 100)}%
                  </span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Calculated Failure Probability
                  </p>
                </div>
                
                <div className="probability-display">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>Normal (Safe)</span>
                      <span>Danger Threshold</span>
                    </div>
                    <div className="prob-meter-container">
                      <div className="prob-meter-fill" style={{ width: `${selectedPrediction.failure_probability * 100}%` }} />
                      <div className="prob-marker" style={{ left: '80%' }} /> {/* Danger threshold at 80% */}
                    </div>
                  </div>
                </div>
                
                <div style={{ 
                  padding: '12px', 
                  borderRadius: '6px', 
                  background: selectedPrediction.status === 'Critical' ? 'rgba(239,68,68,0.1)' : selectedPrediction.status === 'Warning' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.06)',
                  border: `1px solid ${selectedPrediction.status === 'Critical' ? 'rgba(239,68,68,0.2)' : selectedPrediction.status === 'Warning' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.15)'}`,
                  fontSize: '0.8rem',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start'
                }}>
                  <Info size={16} style={{ flexShrink: 0, marginTop: '2px', color: selectedPrediction.status === 'Critical' ? 'var(--color-critical)' : selectedPrediction.status === 'Warning' ? 'var(--color-warning)' : 'var(--color-success)' }} />
                  <div>
                    {selectedPrediction.status === 'Critical' ? (
                      <strong>CRITICAL FAILURE RISK: Asset operation limits breached. Immediate action required.</strong>
                    ) : selectedPrediction.status === 'Warning' ? (
                      <strong>WARNING: Feature drifts detected. Scheduled maintenance advised within 48 hours.</strong>
                    ) : (
                      <span>Asset is operating within normal statistical bounds. No actions required.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: SHAP explanations */}
              <div className="card">
                <div className="card-title">
                  <BarChart2 size={16} />
                  <span>SHAP LOCAL FEATURE CONTRIBUTIONS</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Showing features that push the asset toward failure <span style={{ color: 'var(--color-critical)' }}>(Red)</span> or protect it <span style={{ color: 'var(--color-success)' }}>(Green)</span>:
                </p>
                
                <div className="shap-bar-container">
                  {selectedPrediction.contributions.map((c) => {
                    const absVal = Math.min(100, (Math.abs(c.contribution) / 2.0) * 100); // Scale factor
                    const isPositive = c.contribution >= 0;
                    
                    return (
                      <div className="shap-row" key={c.feature}>
                        <span className="shap-label">{c.displayName}</span>
                        <div className="shap-bar-track">
                          <div className="shap-center-line" />
                          <div 
                            className={`shap-bar-fill ${isPositive ? 'positive' : 'negative'}`} 
                            style={{ 
                              width: `${absVal / 2}%`, 
                              left: isPositive ? '50%' : 'auto',
                              right: !isPositive ? '50%' : 'auto'
                            }} 
                          />
                        </div>
                        <span className="shap-val" style={{ color: isPositive ? 'var(--color-critical)' : 'var(--color-success)' }}>
                          {isPositive ? '+' : ''}{c.contribution.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: '20px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <strong>Root Cause Explanation:</strong>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                    {(() => {
                      const sorted = [...selectedPrediction.contributions].sort((a, b) => b.contribution - a.contribution);
                      const topRisk = sorted[0];
                      if (topRisk && topRisk.contribution > 0.5) {
                        return `The primary driver of the failure risk is ${topRisk.displayName} (${topRisk.value.toFixed(1)}${topRisk.unit}), contributing +${topRisk.contribution.toFixed(2)} to the predictive model's probability logs.`;
                      } else {
                        return 'Features are stable. No single parameter is currently driving failure risk metrics.';
                      }
                    })()}
                  </p>
                </div>
              </div>

              {/* Card 3: Rule-based Failure Modes */}
              <div className="card">
                <div className="card-title">
                  <AlertTriangle size={16} />
                  <span>SPECIFIC FAILURE MODE BREAKDOWNS</span>
                </div>
                
                <div className="failure-mode-list">
                  {Object.entries(selectedPrediction.failure_modes).map(([key, mode]) => {
                    const isDanger = mode.risk >= 80 || mode.active;
                    const isWarning = mode.risk >= 40 && mode.risk < 80;
                    
                    return (
                      <div className={`failure-mode-item ${mode.active ? 'active' : ''}`} key={key}>
                        <div className="failure-mode-header">
                          <span className="failure-mode-name">{key} - {key === 'HDF' ? 'Heat Dissipation' : key === 'PWF' ? 'Power Fault' : key === 'OSF' ? 'Overstrain' : key === 'TWF' ? 'Tool Wear' : 'Random Fault'}</span>
                          <span className={`failure-mode-badge ${isDanger ? 'danger' : isWarning ? 'warning' : 'safe'}`}>
                            {mode.active ? 'TRIGGERED' : `${mode.risk}% risk`}
                          </span>
                        </div>
                        <span className="failure-mode-criteria">Criteria: {mode.criteria}</span>
                        <p className="failure-mode-desc">{mode.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 4: Prescriptive Action & Connected Work Order */}
              <div className="card">
                <div className="card-title">
                  <Wrench size={16} />
                  <span>PRESCRIPTIVE REPAIR ACTIONS</span>
                </div>
                
                {selectedPrediction.status !== 'Normal' ? (
                  <div>
                    <p style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
                      Based on current sensor anomalies, the following procedures are recommended:
                    </p>
                    <ul style={{ fontSize: '0.8rem', paddingLeft: '20px', color: 'var(--text-secondary)', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedPrediction.failure_modes.HDF.risk > 50 && (
                        <li><strong>Reduce rotational speed:</strong> Decrease speed below 1350 rpm to increase heat dissipation rates.</li>
                      )}
                      {selectedPrediction.failure_modes.PWF.risk > 50 && (
                        <li><strong>Adjust Torque:</strong> Load parameters are excessive. Back off torque constraints below 50 Nm to prevent engine lockup.</li>
                      )}
                      {selectedPrediction.failure_modes.OSF.risk > 50 && (
                        <li><strong>Structural Overload:</strong> Immediate cooling required. Tool wear * torque threshold breached. Replace cutting head.</li>
                      )}
                      {selectedPrediction.failure_modes.TWF.risk > 50 && (
                        <li><strong>Tool Wear Warning:</strong> Cutting head wear is at {selectedAsset.sensors.tool_wear.toFixed(0)} min. Schedule replacement immediately.</li>
                      )}
                      <li>Inspect primary bearings and housing for structural fractures or leaks.</li>
                    </ul>
                    
                    <button 
                      className="btn btn-danger" 
                      style={{ width: '100%' }}
                      onClick={handleCreateWorkOrder}
                    >
                      <Clipboard size={16} />
                      <span>Dispatch Maintenance Work Order</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <CheckCircle size={32} style={{ color: 'var(--color-success)', marginBottom: '10px' }} />
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Asset is healthy. No actions are required at this time.
                    </p>
                  </div>
                )}
              </div>

            </div>
            
          </div>
        )}

        {/* ROLE TABS VIEW - TECHNICIAN TAB */}
        {activeRole === 'technician' && (
          <div className="card">
            <div className="card-title">
              <Wrench size={16} />
              <span>FIELD MAINTENANCE ACTIVE DISPATCHES</span>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Pending work orders are listed below. Click "Complete Repair" to swap toolheads, reset sensor variables, and restore mechanical OEE health metrics to 100%.
            </p>
            
            {workOrders.filter(w => w.status === 'Pending').length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                <CheckCircle size={40} style={{ color: 'var(--color-success)', marginBottom: '12px' }} />
                <h4 style={{ fontWeight: 600, marginBottom: '4px' }}>All Clear: No Pending Work Orders</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Use the 'Reliability Eng' role tab to simulate anomalies and dispatch work orders here.
                </p>
              </div>
            ) : (
              <div className="work-order-list">
                {workOrders.map((wo) => (
                  <div className={`work-order-item`} key={wo.id}>
                    <div className="work-order-meta">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="work-order-title">{wo.id} - {wo.failureMode}</span>
                        <span className={`badge-priority ${wo.priority}`}>{wo.priority}</span>
                      </div>
                      <div className="work-order-subtext">
                        <span>Target: <strong>{wo.assetName}</strong> ({wo.assetId})</span>
                        <span>Dispatched: {wo.createdAt}</span>
                        <span>Status: <span style={{ color: 'var(--color-warning)' }}>{wo.status}</span></span>
                      </div>
                    </div>
                    
                    {wo.status === 'Pending' ? (
                      <button 
                        className="btn btn-primary"
                        onClick={() => handleResolveWorkOrder(wo.id, wo.assetId)}
                        style={{ fontSize: '0.8rem', padding: '8px 16px' }}
                      >
                        <Check size={16} />
                        <span>Complete Repair</span>
                      </button>
                    ) : (
                      <span style={{ color: 'var(--color-success)', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={16} /> Completed
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ROLE TABS VIEW - PLANT OPERATIONS MANAGER */}
        {activeRole === 'manager' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* OEE & Financial Summary Grid */}
            <div className="manager-metrics">
              
              <div className="card metric-card">
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>OVERALL EQUIPMENT EFFECTIVENESS (OEE)</div>
                <div className="metric-card-val" style={{ color: 'var(--color-primary)' }}>{managerStats.oee}%</div>
                <div className="metric-card-change up">
                  <TrendingUp size={12} />
                  <span>+0.8% from last week</span>
                </div>
              </div>

              <div className="card metric-card">
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>DOWNTIME COST RISK</div>
                <div className="metric-card-val" style={{ color: managerStats.criticalCount > 0 ? 'var(--color-critical)' : 'var(--text-primary)' }}>
                  ${managerStats.downtimeCost.toLocaleString()}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Based on critical / warning assets</p>
              </div>

              <div className="card metric-card">
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>CRITICAL STATUS ASSETS</div>
                <div className="metric-card-val" style={{ color: managerStats.criticalCount > 0 ? 'var(--color-critical)' : 'var(--color-success)' }}>
                  {managerStats.criticalCount} / {assets.length}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Requiring immediate attention</p>
              </div>

              <div className="card metric-card">
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>PREDICTIVE SYSTEM ACCURACY</div>
                <div className="metric-card-val" style={{ color: 'var(--color-success)' }}>98.2%</div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>F1 score validation benchmark</p>
              </div>

            </div>

            {/* Operations Manager Tables */}
            <div className="dashboard-details-layout">
              
              {/* Table of active warnings */}
              <div className="card">
                <div className="card-title">
                  <AlertTriangle size={16} />
                  <span>LINE ALERTS & DIAGNOSTICS</span>
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px' }}>Asset ID</th>
                      <th style={{ padding: '10px' }}>Name</th>
                      <th style={{ padding: '10px' }}>Location / Type</th>
                      <th style={{ padding: '10px' }}>Health Score</th>
                      <th style={{ padding: '10px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => {
                      const pred = assetPredictions[asset.id];
                      return (
                        <tr key={asset.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: pred.status === 'Critical' ? 'rgba(239,68,68,0.02)' : 'transparent' }}>
                          <td style={{ padding: '12px 10px', fontFamily: 'var(--font-mono)' }}>{asset.id}</td>
                          <td style={{ padding: '12px 10px', fontWeight: 600 }}>{asset.name}</td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>{asset.type}</td>
                          <td style={{ padding: '12px 10px', fontFamily: 'var(--font-display)', fontWeight: 700 }} className={pred.status.toLowerCase()}>{pred.health_score}%</td>
                          <td style={{ padding: '12px 10px' }}>
                            <span className={`failure-mode-badge ${pred.status === 'Critical' ? 'danger' : pred.status === 'Warning' ? 'warning' : 'safe'}`}>
                              {pred.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial returns and OEE breakdown */}
              <div className="card">
                <div className="card-title">
                  <DollarSign size={16} />
                  <span>PREDICTIVE MAINTENANCE ROI SCOREBOARD</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span>Avoided Breakdown Costs (MTD)</span>
                      <strong style={{ color: 'var(--color-success)' }}>+$42,800</strong>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                      <div style={{ height: '100%', width: '75%', background: 'var(--color-success)' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span>Downtime Reduction Rate</span>
                      <strong style={{ color: 'var(--color-success)' }}>-38.4%</strong>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                      <div style={{ height: '100%', width: '85%', background: 'var(--color-success)' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span>Spare Parts Inventory Optimization</span>
                      <strong style={{ color: 'var(--color-primary)' }}>+14.2%</strong>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                      <div style={{ height: '100%', width: '45%', background: 'var(--color-primary)' }} />
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(59,130,246,0.05)', borderRadius: '6px', border: '1px dashed rgba(59,130,246,0.2)', fontSize: '0.75rem', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
                  <strong>Manager Tip:</strong> By resolving the warning states on assets via dispatches to field technicians, you can prevent a potential <strong>${managerStats.downtimeCost.toLocaleString()}</strong> operational loss.
                </div>
              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
