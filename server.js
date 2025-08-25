// server.js

import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import fs from "fs";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

// Configure multer to temporarily store uploaded files in the "uploads" folder
const upload = multer({ dest: "uploads/" });

// Available models configuration
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

// Utility function to remove markdown code fences if present
const stripCodeFences = (text) => {
  if (text.startsWith("```")) {
    text = text.replace(/^```(\w+)?\n/, "");
    text = text.replace(/\n```$/, "");
  }
  return text;
};

// Function to call the Groq API and parse resume text into structured JSON
async function parseResumeWithModel(resumeText, modelId) {
  const promptText = `Parse the provided resume text to extract information and categorize it according to the specified fields below. Ensure clarity and attention to detail while following the provided guidelines. The data values in the output should reflect the language used in the resume text.

1. Parse the following fields from the:

   {
     "firstName": "",
     "lastName": "",
     "email": "",
     "phone": "",
     "city": "",
     "fullAddress": "",
     "workExperience": {
       "years": 0,
       "months": 0
     },
     "currentOrganization": "",
     "title": "",
     "skills": [],
     "socialMedia": {
       "facebook": "",
       "twitter": "",
       "linkedin": "",
       "github": "",
       "xing": ""
     },
     "summary": "",
     "workHistory": [
       {
         "title": "Director",
         "employment_type": "",
         "industry_id": 0,
         "salary": "",
         "is_currently_working": false,
         "work_start_date": "",
         "work_end_date": "Present/end date",
         "work_description": "",
         "work_company_name": "",
         "work_location": ""
       }
     ],
     "educationHistory": [
       {
         "institute_name": "",
         "educational_qualification": "",
         "educational_specialization": "",
         "grade": "",
         "education_location": "",
         "education_start_date": "",
         "education_end_date": "",
         "education_description": ""
       }
     ]
   }

2. Determine the language used in the text of the resume and ensure all extracted data values are presented in this language only.

3. Ensure "education_description" and "work_description" are the exact verbatim text from the resume and not generated.

4. Provide only the output strictly in JSON format without any additional comment, character like # or triple backticks or text.

5. Identify and include all relevant skills based on work experience, education, certifications, tech stacks, and any additional details from the resume in the "skills" section. Use LinkedIn's skills taxonomy.

6. Provide separate JSON responses for each entry in the work and education history, even if work or education is present and not in the past. Always use the JSON format specified and never deviate from it.

7. Detailed Candidate 'summary' should be written in third person highlighting experience, industry, core skills and in the language of the resume.

8. Give accurare Total Experience based on calculations.

9. Establish a chain of thought to parse the resume accurately and add that in a json key 'reasoning'.

10. Recognize and normalize language-specific phrases indicating tenure (e.g., “12 ans,” "Mai à aôut 2019," “seit 5 Jahren,” "Depuis 2000," “desde 2013”), or separated date components (e.g., "Janvier - Juin 2019", "Jan", "2019") to accurately calculate start and end dates for work experience or education.

`;

  const payload = {
    model: modelId,
    messages: [
      {
        role: "system",
        content: promptText
      },
      {
        role: "user",
        content: resumeText
      }
    ],
    temperature: 1,
    max_completion_tokens: 7000,
    top_p: 1,
    stream: false,
    response_format: {
      type: "json_object"
    },
    stop: null
  };

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      payload,
      {
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`Raw Groq API response for ${modelId}:`, response.data.choices[0].message.content);
    const parsedContent = response.data.choices[0].message.content.trim();
    const usage = response.data.usage; // expected to include prompt_tokens, completion_tokens, total_tokens
    return { content: parsedContent, usage: usage, model: modelId };
  } catch (error) {
    console.error(
      `Error from Groq API for ${modelId}:`,
      error.response ? error.response.data : error.message
    );
    return { content: null, usage: null, model: modelId, error: error.message };
  }
}

// Endpoint to get available models
app.get("/models", (req, res) => {
  res.json({ 
    success: true, 
    models: Object.entries(AVAILABLE_MODELS).map(([id, config]) => ({
      id,
      ...config
    }))
  });
});

// Endpoint to handle file uploads and processing
app.post("/upload", upload.array("resumes"), async (req, res) => {
  try {
    const { modelId, comparisonMode } = req.body;
    
    // Validate model ID
    if (!modelId || !AVAILABLE_MODELS[modelId]) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid model ID" 
      });
    }

    const parsedResumes = [];

    // Process each uploaded file
    for (const file of req.files) {
      const tFileStart = Date.now();
      let text = "";
      let extractionTime = 0;
      let llamaTime = 0;

      // Extract text based on file type
      if (file.mimetype === "application/pdf") {
        const extractionStart = Date.now();
        const dataBuffer = fs.readFileSync(file.path);
        const data = await pdfParse(dataBuffer);
        text = data.text;
        extractionTime = Date.now() - extractionStart;
      } else if (
        file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.mimetype === "application/msword"
      ) {
        const extractionStart = Date.now();
        const result = await mammoth.extractRawText({ path: file.path });
        text = result.value;
        extractionTime = Date.now() - extractionStart;
      } else {
        text = "Unsupported file type.";
      }

      // Parse with selected model
      const llamaStart = Date.now();
      const llamaResult = await parseResumeWithModel(text, modelId);
      llamaTime = Date.now() - llamaStart;
      const totalTime = Date.now() - tFileStart;

      // Calculate cost using token usage from the API
      let estimatedCost = "N/A";
      if (llamaResult.usage && typeof llamaResult.usage.total_tokens === 'number') {
        const totalTokens = llamaResult.usage.total_tokens;
        const cost = (totalTokens * 0.00034) / 1000; // cost in dollars
        estimatedCost = cost.toFixed(6);
      }

      // Sovren parsing cost (per candidate) is now $0.007
      const sovrenCost = 0.007;
      let savings = "N/A";
      let savingsPercentage = "N/A";
      if (estimatedCost !== "N/A") {
        savings = (sovrenCost - parseFloat(estimatedCost)).toFixed(6);
        savingsPercentage = (((sovrenCost - parseFloat(estimatedCost)) / sovrenCost) * 100).toFixed(2);
      }

      parsedResumes.push({
        filename: file.originalname,
        data: llamaResult.content,
        model: modelId,
        modelName: AVAILABLE_MODELS[modelId].displayName,
        timeMetrics: {
          extractionTime, // in ms
          llamaTime,      // in ms
          totalTime       // in ms
        },
        tokenUsage: llamaResult.usage, // includes prompt_tokens, completion_tokens, total_tokens
        estimatedCost, // in dollars
        sovrenComparison: {
          sovrenCost,
          savings,
          savingsPercentage
        },
        error: llamaResult.error || null
      });

      // Remove the temporary file
      fs.unlinkSync(file.path);
    }

    res.json({ success: true, resumes: parsedResumes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error processing files." });
  }
});

// Endpoint for comparison mode - parse with both models
app.post("/upload/compare", upload.array("resumes"), async (req, res) => {
  try {
    const parsedResumes = [];

    // Process each uploaded file
    for (const file of req.files) {
      const tFileStart = Date.now();
      let text = "";
      let extractionTime = 0;

      // Extract text based on file type
      if (file.mimetype === "application/pdf") {
        const extractionStart = Date.now();
        const dataBuffer = fs.readFileSync(file.path);
        const data = await pdfParse(dataBuffer);
        text = data.text;
        extractionTime = Date.now() - extractionStart;
      } else if (
        file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.mimetype === "application/msword"
      ) {
        const extractionStart = Date.now();
        const result = await mammoth.extractRawText({ path: file.path });
        text = result.value;
        extractionTime = Date.now() - extractionStart;
      } else {
        text = "Unsupported file type.";
      }

      const modelResults = [];
      const modelIds = Object.keys(AVAILABLE_MODELS);

      // Parse with all models
      for (const modelId of modelIds) {
        const llamaStart = Date.now();
        const llamaResult = await parseResumeWithModel(text, modelId);
        const llamaTime = Date.now() - llamaStart;

        // Calculate cost using token usage from the API
        let estimatedCost = "N/A";
        if (llamaResult.usage && typeof llamaResult.usage.total_tokens === 'number') {
          const totalTokens = llamaResult.usage.total_tokens;
          const cost = (totalTokens * 0.00034) / 1000; // cost in dollars
          estimatedCost = cost.toFixed(6);
        }

        // Sovren parsing cost (per candidate) is now $0.007
        const sovrenCost = 0.007;
        let savings = "N/A";
        let savingsPercentage = "N/A";
        if (estimatedCost !== "N/A") {
          savings = (sovrenCost - parseFloat(estimatedCost)).toFixed(6);
          savingsPercentage = (((sovrenCost - parseFloat(estimatedCost)) / sovrenCost) * 100).toFixed(2);
        }

        modelResults.push({
          model: modelId,
          modelName: AVAILABLE_MODELS[modelId].displayName,
          data: llamaResult.content,
          timeMetrics: {
            extractionTime,
            llamaTime,
            totalTime: Date.now() - tFileStart
          },
          tokenUsage: llamaResult.usage,
          estimatedCost,
          sovrenComparison: {
            sovrenCost,
            savings,
            savingsPercentage
          },
          error: llamaResult.error || null
        });
      }

      parsedResumes.push({
        filename: file.originalname,
        models: modelResults,
        extractionTime
      });

      // Remove the temporary file
      fs.unlinkSync(file.path);
    }

    res.json({ success: true, resumes: parsedResumes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error processing files in comparison mode." });
  }
});

// health check — keeps the service awake
app.get('/health', (req, res) => res.send('OK'));
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
