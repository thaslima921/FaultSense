import os
import json
import math
import random

# Seed for reproducibility
random.seed(42)

def normal_dist(mean, std):
    """Box-Muller transform to generate normal distribution samples."""
    u1 = random.random()
    # Avoid log(0)
    while u1 == 0:
        u1 = random.random()
    u2 = random.random()
    z0 = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
    return mean + std * z0

def generate_data(n_samples=10000):
    print(f"Generating {n_samples} high-fidelity synthetic records matching UCI AI4I 2020 dataset...")
    data = []
    
    # Counts of failures for reporting
    failure_counts = {"TWF": 0, "HDF": 0, "PWF": 0, "OSF": 0, "RNF": 0}
    total_failures = 0
    
    for _ in range(n_samples):
        # 1. Air temperature [K]: mean 300.0, std 2.0
        air_temp = normal_dist(300.0, 2.0)
        
        # 2. Process temperature [K]: air_temp + mean 10.0, std 1.0
        process_temp = air_temp + normal_dist(10.0, 1.0)
        
        # 3. Rotational speed [rpm]: mean 1500.0, std 150.0, clipped at min 1000
        rot_speed = normal_dist(1500.0, 150.0)
        if rot_speed < 1000.0:
            rot_speed = 1000.0
            
        # 4. Torque [Nm]: negatively correlated with rotational speed, mean 40.0, std 5.0
        torque = 40.0 - 0.02 * (rot_speed - 1500.0) + normal_dist(0.0, 5.0)
        if torque < 5.0:
            torque = 5.0
        elif torque > 80.0:
            torque = 80.0
            
        # 5. Tool wear [min]: uniform distribution 0 to 240
        tool_wear = random.uniform(0.0, 240.0)
        
        # Determine failures
        # Heat Dissipation Failure (HDF): dT = process_temp - air_temp < 8.6 and speed < 1380
        hdf = 1 if ((process_temp - air_temp) < 8.6 and rot_speed < 1380.0) else 0
        
        # Power Failure (PWF): Power = Torque * speed * 2pi/60. PWF if Power < 3500 W or > 9000 W
        power = torque * rot_speed * (2.0 * math.pi / 60.0)
        pwf = 1 if (power < 3500.0 or power > 9000.0) else 0
        
        # Overstrain Failure (OSF): tool_wear * torque > 11000
        osf = 1 if (tool_wear * torque > 11000.0) else 0
        
        # Tool Wear Failure (TWF): tool_wear > 210, with 30% failure rate
        twf = 1 if (tool_wear > 210.0 and random.random() < 0.3) else 0
        
        # Random Failure (RNF): 0.1% chance
        rnf = 1 if (random.random() < 0.001) else 0
        
        failure = 1 if (hdf or pwf or osf or twf or rnf) else 0
        
        if failure:
            total_failures += 1
            if hdf: failure_counts["HDF"] += 1
            if pwf: failure_counts["PWF"] += 1
            if osf: failure_counts["OSF"] += 1
            if twf: failure_counts["TWF"] += 1
            if rnf: failure_counts["RNF"] += 1
            
        data.append({
            "air_temp": air_temp,
            "process_temp": process_temp,
            "rot_speed": rot_speed,
            "torque": torque,
            "tool_wear": tool_wear,
            "failure": failure
        })
        
    print(f"Dataset summary: {total_failures} failures ({total_failures / n_samples * 100:.2f}%)")
    print(f"Failure breakdowns: {failure_counts}")
    return data, failure_counts

def train_logistic_regression(data, feature_cols, target_col="failure", epochs=500, alpha=0.1):
    n = len(data)
    d = len(feature_cols)
    
    # 1. Extract lists for features and targets
    X = [[item[col] for col in feature_cols] for item in data]
    y = [item[target_col] for item in data]
    
    # 2. Standardize Features: Calculate mean and std
    means = []
    stds = []
    for j in range(d):
        col_vals = [row[j] for row in X]
        mean_val = sum(col_vals) / n
        variance = sum((v - mean_val) ** 2 for v in col_vals) / n
        std_val = math.sqrt(variance) if variance > 0 else 1.0
        means.append(mean_val)
        stds.append(std_val)
        
    # Scale X
    X_scaled = []
    for row in X:
        scaled_row = [(row[j] - means[j]) / stds[j] for j in range(d)]
        X_scaled.append(scaled_row)
        
    # 3. Calculate Class Weights for balanced class weighting
    n_pos = sum(y)
    n_neg = n - n_pos
    w_pos = n / (2.0 * n_pos) if n_pos > 0 else 1.0
    w_neg = n / (2.0 * n_neg) if n_neg > 0 else 1.0
    sample_weights = [w_pos if label == 1 else w_neg for label in y]
    sum_sw = sum(sample_weights)
    
    # 4. Train Model via Gradient Descent
    # Weights and intercept initialization
    w = [0.0] * d
    b = 0.0
    
    print("Training Logistic Regression model...")
    for epoch in range(epochs):
        grad_w = [0.0] * d
        grad_b = 0.0
        
        # Calculate gradients
        for i in range(n):
            x_i = X_scaled[i]
            y_i = y[i]
            sw_i = sample_weights[i]
            
            # Logit
            z = b + sum(w[j] * x_i[j] for j in range(d))
            
            # Probability via sigmoid
            # Clip z to prevent overflow
            z = max(-100.0, min(100.0, z))
            p = 1.0 / (1.0 + math.exp(-z))
            
            # Loss gradient
            error = p - y_i
            weighted_error = sw_i * error
            
            for j in range(d):
                grad_w[j] += weighted_error * x_i[j]
            grad_b += weighted_error
            
        # Divide by sum of sample weights
        grad_w = [gw / sum_sw for gw in grad_w]
        grad_b = grad_b / sum_sw
        
        # Update weights
        for j in range(d):
            w[j] -= alpha * grad_w[j]
        b -= alpha * grad_b
        
        # Monitor cross-entropy loss periodically
        if (epoch + 1) % 100 == 0:
            loss = 0.0
            for i in range(n):
                x_i = X_scaled[i]
                y_i = y[i]
                sw_i = sample_weights[i]
                z = b + sum(w[j] * x_i[j] for j in range(d))
                z = max(-100.0, min(100.0, z))
                p = 1.0 / (1.0 + math.exp(-z))
                # Add small epsilon to prevent log(0)
                p = max(1e-15, min(1.0 - 1e-15, p))
                loss += sw_i * (-y_i * math.log(p) - (1.0 - y_i) * math.log(1.0 - p))
            loss /= sum_sw
            print(f"Epoch {epoch + 1}/{epochs} | Balanced Loss: {loss:.6f}")
            
    print("Training completed.")
    return w, b, means, stds

def main():
    # 1. Generate data
    data, failure_counts = generate_data(10000)
    
    # 2. Define features
    feature_cols = ["air_temp", "process_temp", "rot_speed", "torque", "tool_wear"]
    
    # 3. Train
    weights, intercept, means, stds = train_logistic_regression(data, feature_cols)
    
    # 4. Create metadata dictionary
    model_metadata = {
        "coefs": {col: float(w) for col, w in zip(feature_cols, weights)},
        "intercept": float(intercept),
        "scaling": {
            col: {"mean": float(m), "std": float(s)}
            for col, m, s in zip(feature_cols, means, stds)
        },
        "dataset_summary": {
            "total_records": len(data),
            "failure_rate": sum(item["failure"] for item in data) / len(data),
            "failure_types": failure_counts
        }
    }
    
    # Ensure export directory exists
    os.makedirs("src/data", exist_ok=True)
    
    # Write metadata file
    with open("src/data/model_metadata.json", "w") as f:
        json.dump(model_metadata, f, indent=2)
        
    print("Model parameters exported successfully:")
    print(f"Intercept: {intercept:.4f}")
    for col, w, m, s in zip(feature_cols, weights, means, stds):
        print(f"Feature: {col:<15} Weight: {w:>8.4f} | Mean: {m:>8.2f} | Std: {s:>6.2f}")
        
if __name__ == "__main__":
    main()
