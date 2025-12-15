# ML Training & Forecasting - Code Explanation Guide

**For Professor Review and Q&A**

---

## 📋 Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Technology Stack](#technology-stack)
3. [Training Page (`/train`)](#training-page-train)
4. [Forecasting Page (`/forecast`)](#forecasting-page-forecast)
5. [ML Model Implementation](#ml-model-implementation)
6. [Model Storage & Management](#model-storage--management)
7. [Hyperparameter Tuning](#hyperparameter-tuning)
8. [Common Questions & Answers](#common-questions--answers)

---

## Overview & Architecture

### What Does This System Do?

This system implements **Machine Learning (ML) time series forecasting** for emigrant data. It allows users to:

1. **Train ML models** on historical emigrant data (by destination country or age group)
2. **Generate predictions** for future years (5-10 years ahead)
3. **Compare predictions** with historical data
4. **Manage multiple trained models** (save, load, export, import, delete)

### System Flow Diagram

```
User selects data (country/age group)
    ↓
Training Page: Train model with hyperparameter tuning
    ↓
Model trained → Saved to IndexedDB (browser) + Firebase metadata
    ↓
Forecasting Page: Load trained model
    ↓
Generate predictions for future years
    ↓
Display results in chart + table format
```

### Key Components

```
📁 src/
├── 📄 routes/
│   ├── train.tsx          # Training page UI
│   └── forecast.tsx       # Forecasting page UI
├── 📁 ml/
│   └── forecastModel.ts   # Core ML model (TensorFlow.js)
├── 📁 api/
│   ├── modelService.ts           # Local storage (IndexedDB + localStorage)
│   ├── modelManagementService.ts # High-level model operations
│   └── firebaseModelService.ts   # Firebase metadata sync
└── 📁 hooks/
    └── useTrendData.ts    # Fetch historical data from Firestore
```

---

## Technology Stack

### Core Technologies

1. **TensorFlow.js** (`@tensorflow/tfjs`)
   - Client-side ML (runs in browser)
   - No server required
   - Uses WebGL for GPU acceleration

2. **React + TypeScript**
   - Modern UI framework
   - Type safety for ML operations

3. **Firebase Firestore**
   - Historical data storage
   - Model metadata storage

4. **IndexedDB**
   - Browser database for storing trained models (FREE, no server costs)
   - Models stored as binary data

5. **LocalStorage**
   - Model metadata (names, metrics, configs)
   - Quick lookup without querying IndexedDB

---

## Training Page (`/train`)

### File: `src/routes/train.tsx`

### What This Page Does

1. **Data Selection**
   - User selects data type: `destination` (country) or `age` (age group)
   - User selects specific item (e.g., "United States" or "25-29 years")

2. **Model Training**
   - Automatically tests 8 different hyperparameter configurations
   - Selects best model based on accuracy
   - Saves model to browser storage

3. **Model Management**
   - View all saved models for selected item
   - Export/import models as JSON files
   - Delete models

### Key Code Sections

#### 1. State Management

```typescript
const [dataType, setDataType] = useState<DataType>("destination");
const [selectedItem, setSelectedItem] = useState<string>("");
const [isTraining, setIsTraining] = useState(false);
const [trainedModel, setTrainedModel] = useState<{...} | null>(null);
const [savedModels, setSavedModels] = useState<SavedModelInfo[]>([]);
```

**Why?** Tracks current selection, training state, and trained models.

#### 2. Data Fetching

```typescript
const { countryTrends, ageGroupTrends, loading, error, countries, ageGroups } = useTrendData();
```

**Why?** Uses custom hook to fetch historical emigrant data from Firestore. Returns structured data for charts and training.

#### 3. Training Handler

```typescript
const handleTrain = async () => {
  if (selectedTrendData.length < 6) {
    setError("Need at least 6 data points to train the model");
    return;
  }

  const result = await ModelManagementService.trainModelWithTuning(
    selectedTrendData,    // Historical data
    dataType,             // "destination" or "age"
    selectedItem,         // e.g., "United States"
    (current, total, config, metrics) => {
      // Progress callback - updates UI during training
      setTrainingProgress({ current, total, config, metrics });
    }
  );

  setTrainedModel({
    modelId: result.modelId,
    metrics: result.metrics,
    config: result.config,
  });
};
```

**Why?**
- Validates minimum data points (ML needs sufficient history)
- Calls service that handles hyperparameter tuning
- Progress callback allows real-time UI updates
- Stores result for display

#### 4. Hyperparameter Tuning Display

The page shows real-time progress of testing 8 configurations:
- Window sizes: 3, 5, 7 years
- Network architectures: [32,16], [64,32,16], [128,64,32], [256,128,64]
- Activations: ReLU, ELU
- Learning rates: 0.001, 0.0005

---

## Forecasting Page (`/forecast`)

### File: `src/routes/forecast.tsx`

### What This Page Does

1. **Load Trained Models**
   - Lists all available models for selected data
   - Auto-selects best model (highest accuracy)

2. **Generate Forecasts**
   - Loads selected model from IndexedDB
   - Generates predictions for 5 or 10 future years
   - Displays in chart and table

3. **Visualization**
   - Line chart: Historical (blue) vs Forecast (green dashed)
   - Comparison table: Predicted vs Last Historical value

### Key Code Sections

#### 1. Model Loading

```typescript
const handleLoadModel = async () => {
  const { model, metadata } = await ModelManagementService.loadModel(selectedModel.id);
  setLoadedModel(model);
};
```

**Why?** Loads TensorFlow.js model from IndexedDB into memory. Model must be loaded before forecasting.

#### 2. Forecast Generation

```typescript
const handleForecast = async () => {
  const lastYear = selectedTrendData[selectedTrendData.length - 1].year;
  const predictions = await loadedModel.forecast(forecastHorizon, lastYear + 1);
  setForecasts(predictions);
};
```

**Why?**
- Uses last historical year as starting point
- Calls model's `forecast()` method with horizon (5 or 10 years)
- Stores predictions for display

#### 3. Chart Data Preparation

```typescript
const chartData = useMemo(() => {
  const historical = selectedTrendData.map((d) => ({
    year: d.year.toString(),
    actual: d.value,
    forecast: null,  // No forecast for historical
  }));

  const forecastPoints = forecasts.map((f) => ({
    year: f.year.toString(),
    actual: null,    // No historical for forecast
    forecast: f.value,
  }));

  return [...historical, ...forecastPoints];
}, [selectedTrendData, forecasts]);
```

**Why?** Merges historical and forecast data for chart. Uses `null` to separate lines (actual vs forecast).

#### 4. Comparison Table

The table shows:
- **Year**: Future year
- **Predicted Emigrants**: ML model prediction
- **Historical Emigrants**: Last known value (for comparison)
- **Change**: Absolute difference
- **% Change**: Percentage change

---

## ML Model Implementation

### File: `src/ml/forecastModel.ts`

### Model Architecture: MLP (Multi-Layer Perceptron)

#### Why MLP for Time Series?

1. **Non-linear relationships**: Can learn complex patterns
2. **Flexible architecture**: Adjustable layers/neurons
3. **Browser-compatible**: TensorFlow.js runs client-side
4. **Fast inference**: Quick predictions after training

#### Model Structure

```typescript
export class TimeSeriesMLP {
  private model: tf.Sequential | null = null;
  private config: TrainingConfig;
  private normalizationParams: { min: number; max: number } | null = null;
  private lastKnownValues: number[] = [];
  private isTrained: boolean = false;
}
```

**Key Properties:**
- `model`: TensorFlow.js Sequential model
- `config`: Hyperparameters (window size, layers, learning rate, etc.)
- `normalizationParams`: Min/max for data normalization
- `lastKnownValues`: Last N values used as input for next prediction

#### Building the Model

```typescript
private buildModel(): tf.Sequential {
  const model = tf.sequential();

  // Input layer
  model.add(tf.layers.dense({
    units: this.config.hiddenLayers[0],  // e.g., 64 neurons
    activation: this.config.activation,   // ReLU or ELU
    inputShape: [this.config.windowSize], // e.g., [5] for 5-year window
    kernelInitializer: 'heNormal',
  }));

  // Dropout for regularization (prevents overfitting)
  model.add(tf.layers.dropout({ rate: 0.2 }));

  // Hidden layers (e.g., [64, 32, 16])
  for (let i = 1; i < this.config.hiddenLayers.length; i++) {
    model.add(tf.layers.dense({
      units: this.config.hiddenLayers[i],
      activation: this.config.activation,
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
  }

  // Output layer (single value: next year's prediction)
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear',  // Linear for regression (continuous values)
  }));

  // Compile with Adam optimizer
  model.compile({
    optimizer: tf.train.adam(this.config.learningRate),
    loss: 'meanSquaredError',  // MSE for regression
    metrics: ['mae', 'mse'],
  });

  return model;
}
```

**Why This Architecture?**
- **Dense layers**: Fully connected, good for time series
- **Dropout (0.2)**: Randomly drops 20% neurons during training to prevent overfitting
- **He Normal initialization**: Better for ReLU/ELU activations
- **Adam optimizer**: Adaptive learning rate, good for time series
- **Linear output**: Single continuous value (emigrant count)

#### Training Process

```typescript
async train(data: TimeSeriesPoint[]): Promise<ModelMetrics> {
  // 1. Sort data by year
  const sortedData = [...data].sort((a, b) => a.year - b.year);

  // 2. Normalize data (0-1 range for better training)
  const normalized = normalizeData(sortedData.map(d => d.value));
  this.normalizationParams = { min, max };

  // 3. Create windowed dataset
  // Input: [year1, year2, year3, year4, year5]
  // Output: year6
  const { X, y } = createWindowedDataset(normalized, this.config.windowSize);

  // 4. Split into train/validation (80/20)
  const splitIndex = Math.floor(X.length * (1 - this.config.validationSplit));
  const XTrain = X.slice(0, splitIndex);
  const yTrain = y.slice(0, splitIndex);
  const XVal = X.slice(splitIndex);
  const yVal = y.slice(splitIndex);

  // 5. Build and train model
  this.model = this.buildModel();
  await this.model.fit(XTrain, yTrain, {
    epochs: this.config.epochs,      // e.g., 100 iterations
    batchSize: this.config.batchSize, // e.g., 8 samples per batch
    validationData: [XVal, yVal],
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        // Track training progress
      }
    }
  });

  // 6. Evaluate model
  const metrics = this.evaluateModel(XVal, yVal);

  // 7. Store last known values for forecasting
  this.lastKnownValues = normalized.slice(-this.config.windowSize);

  return metrics;
}
```

**Key Concepts:**
- **Windowed dataset**: Creates sliding windows (e.g., years 1-5 → year 6)
- **Normalization**: Scales data to 0-1 for faster convergence
- **Train/validation split**: Prevents overfitting, measures generalization
- **Epochs**: Number of times model sees entire dataset
- **Batch size**: Number of samples processed before weight update

#### Forecasting Process

```typescript
async forecast(horizon: number, startYear: number): Promise<ForecastResult[]> {
  const forecasts: ForecastResult[] = [];
  let currentWindow = [...this.lastKnownValues];  // Last N values

  for (let i = 0; i < horizon; i++) {
    // 1. Predict next value
    const input = tf.tensor2d([currentWindow]);  // Shape: [1, windowSize]
    const prediction = this.model.predict(input) as tf.Tensor;
    const predictedValue = (await prediction.data())[0];

    // 2. Denormalize (convert back to original scale)
    const denormalizedValue = denormalizeData(
      [predictedValue],
      this.normalizationParams.min,
      this.normalizationParams.max
    )[0];

    // 3. Ensure non-negative (emigrant counts can't be negative)
    const finalValue = Math.max(0, Math.round(denormalizedValue));

    forecasts.push({
      year: startYear + i,
      value: finalValue,
      type: 'forecast',
    });

    // 4. Update window: remove oldest, add new prediction
    // This is called "autoregressive forecasting"
    currentWindow = [...currentWindow.slice(1), predictedValue];
  }

  return forecasts;
}
```

**Autoregressive Forecasting:**
- Uses previous predictions as input for next prediction
- Example: If window=5, and we predict year 2024, we use [2019, 2020, 2021, 2022, 2023]
- Then to predict 2025, we use [2020, 2021, 2022, 2023, 2024] (slide window forward)

---

## Model Storage & Management

### File: `src/api/modelService.ts`

### Why Two Storage Systems?

1. **IndexedDB**: Stores TensorFlow.js model weights (binary data, large)
2. **LocalStorage**: Stores metadata (JSON, small, quick lookup)

### Storage Flow

```
Training completes
    ↓
Model weights → IndexedDB (async, large)
Model metadata → LocalStorage (sync, small)
    ↓
(Optional) Metadata → Firebase Firestore (sync across devices)
```

### IndexedDB Storage

```typescript
// Save model
await model.save(`indexeddb://tfjs_model_${modelId}`);

// Load model
const model = await tf.loadLayersModel(`indexeddb://${modelStorageKey}`);
```

**Why IndexedDB?**
- Can store large binary data (model weights)
- Asynchronous (doesn't block UI)
- Persists across browser sessions
- No server costs (runs in browser)

### Metadata Structure

```typescript
interface SavedModel {
  id: string;                    // Unique identifier
  name: string;                  // Technical name
  displayName: string;           // User-friendly name
  dataType: 'destination' | 'age';
  selectedItem: string;          // e.g., "United States"
  config: TrainingConfig;        // Hyperparameters used
  metrics: ModelMetrics;         // Accuracy, R², MAE, etc.
  modelStorageKey: string;       // IndexedDB key
  normalizationParams: {...};    // For denormalization
  lastKnownValues: number[];     // For autoregressive forecasting
  createdAt: string;
  lastUsed?: string;
}
```

**Why Store All This?**
- **normalizationParams**: Needed to convert predictions back to original scale
- **lastKnownValues**: Needed to start autoregressive forecasting
- **config**: Needed to reconstruct model architecture when loading

### Export/Import

Models can be exported as JSON files containing:
- Model weights (base64 encoded)
- Metadata (config, metrics, normalization params)

**Use Case**: Share models between users or backup models locally.

---

## Hyperparameter Tuning

### File: `src/api/modelManagementService.ts`

### What Is Hyperparameter Tuning?

Testing multiple configurations to find the best model. Like trying different settings to get best results.

### Grid Search Implementation

```typescript
static async trainModelWithTuning(...) {
  // Define 8 different configurations
  const paramGrid: Partial<TrainingConfig>[] = [
    { windowSize: 3, hiddenLayers: [32, 16], activation: 'relu', learningRate: 0.001 },
    { windowSize: 3, hiddenLayers: [64, 32, 16], activation: 'relu', learningRate: 0.001 },
    { windowSize: 5, hiddenLayers: [64, 32, 16], activation: 'relu', learningRate: 0.001 },
    { windowSize: 5, hiddenLayers: [64, 32, 16], activation: 'elu', learningRate: 0.001 },
    { windowSize: 5, hiddenLayers: [128, 64, 32], activation: 'relu', learningRate: 0.001 },
    { windowSize: 7, hiddenLayers: [64, 32, 16], activation: 'relu', learningRate: 0.001 },
    { windowSize: 7, hiddenLayers: [128, 64, 32], activation: 'relu', learningRate: 0.0005 },
    { windowSize: 5, hiddenLayers: [256, 128, 64], activation: 'relu', learningRate: 0.0005 },
  ];

  // Test each configuration
  const { bestConfig, bestMetrics } = await tempModel.hyperparameterTuning(
    data,
    paramGrid,
    onProgress  // Callback for UI updates
  );

  // Train final model with best configuration
  const finalModel = new TimeSeriesMLP(bestConfig);
  const finalMetrics = await finalModel.train(data);
  
  return { modelId, metrics: finalMetrics, config: bestConfig };
}
```

### What Each Hyperparameter Does

1. **Window Size** (3, 5, 7)
   - How many past years to use for prediction
   - Larger = more context, but may overfit on short datasets

2. **Hidden Layers** ([32,16], [64,32,16], [128,64,32], [256,128,64])
   - Network depth and width
   - Larger = more capacity, but slower and may overfit

3. **Activation** (ReLU, ELU)
   - Non-linearity function
   - ELU can handle negative values better

4. **Learning Rate** (0.001, 0.0005)
   - Step size during training
   - Smaller = more stable, but slower

### Selection Criteria

Best model = **Highest Accuracy** (or lowest validation loss)

Accuracy is calculated as: `(1 - MAPE) * 100`, where MAPE = Mean Absolute Percentage Error

---

## Common Questions & Answers

### Q1: Why Use TensorFlow.js Instead of Python/Server-Side ML?

**Answer:**
- **Cost**: No server costs (runs in user's browser)
- **Privacy**: Data never leaves user's device
- **Speed**: No network latency for predictions
- **Scalability**: Each user's browser handles their own training
- **Deployment**: Works offline after initial page load

**Trade-off**: Limited by browser capabilities, but sufficient for this use case.

---

### Q2: Why MLP (Multi-Layer Perceptron) Instead of LSTM/GRU?

**Answer:**
1. **Simplicity**: Easier to implement and debug
2. **Data size**: Our datasets are relatively small (<100 years), MLP is sufficient
3. **Speed**: Faster training and inference
4. **Browser compatibility**: TensorFlow.js LSTM support is more complex
5. **Windowed approach**: We manually create windows, which works well with MLP

**Note**: LSTM would be better for very long sequences, but not necessary here.

---

### Q3: How Do You Prevent Overfitting?

**Answer:**
1. **Dropout layers** (0.2 rate): Randomly disable 20% of neurons during training
2. **Train/Validation split** (80/20): Train on 80%, validate on 20%
3. **Early stopping**: Stop training if validation loss stops improving (implemented in tuning)
4. **Regularization**: L2 regularization via TensorFlow.js optimizers

---

### Q4: Why Normalize Data?

**Answer:**
- **Faster convergence**: Neural networks train faster on 0-1 range
- **Gradient stability**: Prevents exploding/vanishing gradients
- **Consistent scales**: Different features (years vs counts) are on same scale

**Formula**: `normalized = (value - min) / (max - min)`
**Reverse**: `denormalized = normalized * (max - min) + min`

---

### Q5: How Does Autoregressive Forecasting Work?

**Answer:**
1. Start with last N historical values (window size)
2. Predict next value using these N values
3. Shift window: remove oldest, add new prediction
4. Repeat for desired horizon

**Example (window=5, predicting 3 years):**
```
Initial: [2019, 2020, 2021, 2022, 2023] → Predict 2024
Step 1:  [2020, 2021, 2022, 2023, 2024] → Predict 2025
Step 2:  [2021, 2022, 2023, 2024, 2025] → Predict 2026
```

**Limitation**: Errors compound over time (each prediction uses previous predictions).

---

### Q6: What Metrics Do You Use to Evaluate Models?

**Answer:**

1. **Accuracy** (calculated from MAPE):
   ```
   Accuracy = (1 - MAPE) * 100%
   ```
   - Range: 0-100%
   - Higher is better
   - Our primary selection criteria

2. **R² (Coefficient of Determination)**:
   - Range: -∞ to 1
   - 1 = perfect fit, 0 = no better than average, negative = worse than average
   - Measures how well model explains variance

3. **MAE (Mean Absolute Error)**:
   - Average absolute difference between predictions and actuals
   - Lower is better
   - Same units as data (emigrants)

4. **RMSE (Root Mean Squared Error)**:
   - Similar to MAE, but penalizes large errors more
   - Lower is better

5. **MAPE (Mean Absolute Percentage Error)**:
   - Percentage error
   - Lower is better
   - Good for comparing across different scales

---

### Q7: Why Store Models in IndexedDB Instead of Firebase?

**Answer:**
1. **Cost**: Firebase storage costs money, IndexedDB is free
2. **Size**: Models can be large (several MB), IndexedDB handles this well
3. **Speed**: Local access is instant
4. **Offline**: Works without internet
5. **Privacy**: Models stay on user's device

**Firebase is used only for**: Metadata sync (optional, for multi-device access)

---

### Q8: What Happens If User Has Less Than 6 Data Points?

**Answer:**
- Training is **blocked** with error message
- **Why 6?**: Minimum needed for windowed dataset + train/validation split
- Example: Window size 5 needs at least 5 input + 1 output = 6 points minimum

---

### Q9: How Do You Handle Negative Predictions?

**Answer:**
```typescript
const finalValue = Math.max(0, Math.round(denormalizedValue));
```

- Emigrant counts cannot be negative
- Any negative prediction is clamped to 0
- Then rounded to nearest integer (whole person count)

---

### Q10: Why Use Windowed Dataset Instead of Full Sequence?

**Answer:**
1. **MLP limitation**: MLP expects fixed-size input
2. **Focus on recent trends**: Recent years are more relevant than old years
3. **Computational efficiency**: Smaller input = faster training
4. **Flexibility**: Can adjust window size based on data characteristics

**Alternative (LSTM)**: Could use full sequence, but more complex and not needed here.

---

### Q11: How Do You Choose the 8 Hyperparameter Configurations?

**Answer:**
Based on common ML best practices and testing:
- **Small → Large networks**: Test if more capacity helps
- **Short → Long windows**: Test if more context helps
- **ReLU → ELU**: Test different activations
- **Standard → Lower LR**: Test if lower learning rate improves stability

**Future improvement**: Could use random search or Bayesian optimization instead of grid search.

---

### Q12: What Happens When User Exports a Model?

**Answer:**
1. Load model from IndexedDB
2. Convert weights to base64 JSON
3. Include all metadata (config, metrics, normalization params)
4. Download as `.json` file

**File structure:**
```json
{
  "modelTopology": {...},
  "weightSpecs": [...],
  "weights": [...],
  "metadata": {
    "config": {...},
    "metrics": {...},
    "normalizationParams": {...},
    "lastKnownValues": [...]
  }
}
```

User can import this file on another device or share with others.

---

## 🎯 Key Takeaways for Presentation

1. **Architecture**: Client-side ML using TensorFlow.js (no server costs)
2. **Model**: MLP with windowed time series approach
3. **Tuning**: Automatic hyperparameter grid search (8 configurations)
4. **Storage**: IndexedDB for models, LocalStorage for metadata
5. **Forecasting**: Autoregressive approach (uses previous predictions)
6. **Evaluation**: Multiple metrics (Accuracy, R², MAE, RMSE, MAPE)
7. **User Experience**: Real-time progress, model management, data visualization

---

## 📚 Additional Resources for Deep Dive

If professor asks for more details:

- **TensorFlow.js Docs**: https://www.tensorflow.org/js
- **Time Series Forecasting**: Standard windowed approach
- **Hyperparameter Tuning**: Grid search vs random search vs Bayesian optimization
- **MLP Architecture**: Standard fully connected network
- **IndexedDB API**: Browser storage for large binary data

---

## 🔍 Code Locations Reference

- **Training Page**: `src/routes/train.tsx`
- **Forecasting Page**: `src/routes/forecast.tsx`
- **ML Model Class**: `src/ml/forecastModel.ts`
- **Model Service**: `src/api/modelService.ts`
- **Model Management**: `src/api/modelManagementService.ts`
- **Data Hook**: `src/hooks/useTrendData.ts`

---

**Good luck with your presentation!** 🚀

