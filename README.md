# CV Parser with LLM Models

A resume parsing application that uses multiple LLM models through Groq API to extract structured information from resumes.

## Features

### 🚀 Model Selection
- **GPT-20B**: OpenAI's GPT-OSS-20B model (default)
- **Llama 4 Scout**: Meta's Llama-4-Scout-17B-16E-Instruct model
- Easy model switching through settings

### 🔄 Comparison Mode
- Parse resumes using both models simultaneously
- Side-by-side comparison of parsing results
- Performance metrics for each model
- Cost analysis and savings calculation

### ⚙️ Settings Panel
- Accessible via the settings button (⚙️) in the top-right corner
- Model selection dropdown
- Comparison mode toggle
- Real-time configuration updates

### 📊 Enhanced Analytics
- Detailed time metrics for each model
- Token usage tracking
- Cost comparison with Sovren
- Employment gap and overlap detection

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Groq API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cv-parser-llama
```

2. Install dependencies:
```bash
npm install
cd resume-parser-frontend
npm install
```

3. Set up environment variables:
```bash
# In the root directory
echo "GROQ_API_KEY=your_groq_api_key_here" > .env
```

4. Start the backend server:
```bash
# From the root directory
node server.js
```

5. Start the frontend:
```bash
# From resume-parser-frontend directory
npm start
```

## Usage

### Basic Parsing
1. Click the settings button (⚙️) to configure your preferred model
2. Upload one or more resume files (PDF, DOC, DOCX)
3. Click "Parse" to extract information
4. View the parsed results with detailed analytics

### Comparison Mode
1. Enable "Comparison Mode" in settings
2. Upload resumes as usual
3. Click "Parse & Compare" to process with both models
4. Use the tabs to switch between model results
5. Compare performance metrics and parsing accuracy

### Supported File Formats
- PDF (.pdf)
- Microsoft Word (.doc, .docx)

## API Endpoints

- `GET /models` - Get available models
- `POST /upload` - Parse resumes with single model
- `POST /upload/compare` - Parse resumes with all models for comparison
- `GET /health` - Health check

## Model Configuration

The application supports multiple models through Groq API:

```javascript
const AVAILABLE_MODELS = {
  "openai/gpt-oss-20b": {
    name: "gpt-20B",
    displayName: "GPT-20B",
    provider: "groq",
    isDefault: true
  },
  "meta-llama/llama-4-scout-17b-16e-instruct": {
    name: "llama-4-scout",
    displayName: "Llama 4 Scout",
    provider: "groq",
    isDefault: false
  }
};
```

## Features in Detail

### Employment Analysis
- Automatic detection of employment gaps
- Overlap detection between jobs
- Experience calculation and validation
- Average tenure per role and company

### Cost Analysis
- Real-time cost calculation based on token usage
- Comparison with industry standard (Sovren)
- Savings percentage calculation
- Detailed breakdown of costs per model

### Error Handling
- Graceful handling of parsing failures
- Model-specific error messages
- Fallback options for failed requests
- Comprehensive logging for debugging

## Debugging

The application includes debugger statements for easy debugging:
- Use browser developer tools to set breakpoints
- Check console for detailed error messages
- Monitor network requests for API calls

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
