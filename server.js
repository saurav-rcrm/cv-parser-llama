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

// Utility function to remove markdown code fences if present
const stripCodeFences = (text) => {
  if (text.startsWith("```")) {
    text = text.replace(/^```(\w+)?\n/, "");
    text = text.replace(/\n```$/, "");
  }
  return text;
};

// Function to call the Together.xyz LLAMA API and parse resume text into structured JSON
async function parseResumeWithLLAMA(resumeText) {
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
     "educationalQualification": "",
     "workHistory": [
       {
         "title": "Director",
         "employment_type": "",
         "industry_id": 0,
         "salary": "",
         "is_currently_working": false,
         "work_start_date": "",
         "work_end_date": "present/end date",
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

2. Determine the language used in the text of the resume and ensure all extracted data values are presented in this language.

3. Ensure "education_description" and "work_description" are the exact verbatim text from the resume and not generated.

4. Provide only the output strictly in JSON format without any additional comment, character like # or triple backticks or text.

5. Generate additional relevant skills inspired by the work experience, education, certification, any other details from the resume in "skills". Use skills taxonomy.

6. Provide separate JSON responses for each entry in the work and education history.

7. Candidate 'summary' should be written in third person highlighting experience, industry, and core skills.`;

  const payload = {
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
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
    console.log("Raw Groq API response:", response.data.choices[0].message.content);
    const parsedContent = response.data.choices[0].message.content.trim();
    const usage = response.data.usage; // expected to include prompt_tokens, completion_tokens, total_tokens
    return { content: parsedContent, usage: usage };
  } catch (error) {
    console.error(
      "Error from Groq API:",
      error.response ? error.response.data : error.message
    );
    return { content: null, usage: null };
  }
}

// Endpoint to handle file uploads and processing
app.post("/upload", upload.array("resumes"), async (req, res) => {
  try {
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

      // Call the LLAMA API to parse the resume text
      const llamaStart = Date.now();
      const llamaResult = await parseResumeWithLLAMA(text);
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
        }
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
// health check — keeps the service awake
app.get('/health', (req, res) => res.send('OK'));
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
