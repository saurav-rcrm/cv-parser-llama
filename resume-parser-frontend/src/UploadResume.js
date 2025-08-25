// src/UploadResume.js

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Card,
  CardContent,
  Paper,
  Container,
  Grid,
  Button,
  CircularProgress,
  Chip,
  Divider,
  Snackbar,
  Alert,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Tabs,
  Tab
} from '@mui/material';
import {
  CloudUpload,
  AccessTime,
  Work,
  School,
  Category,
  ThumbUp,
  ThumbDown,
  Email,
  Phone,
  LocationOn,
  EmojiPeople,
  ExpandMore,
  ExpandLess,
  Settings,
  CompareArrows
} from '@mui/icons-material';
import { Tooltip } from '@mui/material';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import GitHubIcon   from '@mui/icons-material/GitHub';
import TwitterIcon  from '@mui/icons-material/Twitter';
import FacebookIcon from '@mui/icons-material/Facebook';
import BusinessIcon from '@mui/icons-material/Business';
import axios from 'axios';

// Apps Script webhook URL
const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzmXXo7HytfcR_NVeGTH_FzU6RgHmkKsnBJ0dJ8t94hBWFWigvteKKCbt_fCy1oT-8Qiw/exec';

// Utility: strip markdown code fences
const stripCodeFences = (text) =>
  text.startsWith('```')
    ? text.replace(/^```(\w+)?\n/, '').replace(/\n```$/, '')
    : text;

// Utility: Parse date string to Date object
const parseDate = (dateStr) => {
  if (!dateStr || dateStr === 'Present' || dateStr === 'Current') {
    return new Date();
  }
  
  // Handle various date formats
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // Try parsing common formats
    const formats = [
      /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
      /(\d{1,2})-(\d{1,2})-(\d{4})/, // MM-DD-YYYY
      /(\d{4})\/(\d{1,2})\/(\d{1,2})/, // YYYY/MM/DD
      /(\d{1,2})\/(\d{4})/, // MM/YYYY
      /(\d{4})/, // YYYY only
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format.source === '(\d{1,2})\/(\d{4})') {
          // MM/YYYY format
          return new Date(parseInt(match[2]), parseInt(match[1]) - 1, 1);
        } else if (format.source === '(\d{4})') {
          // YYYY only format
          return new Date(parseInt(match[1]), 0, 1);
        } else {
          // Full date format
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        }
      }
    }
    
    // If all parsing fails, return current date
    console.warn(`Could not parse date: ${dateStr}, using current date`);
    return new Date();
  }
  
  return date;
};

// Utility: Calculate experience between two dates
const calculateExperience = (startDate, endDate) => {
  try {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const years = Math.floor(diffDays / 365.25);
    const months = Math.floor((diffDays % 365.25) / 30.44);
    
    return { years, months, totalDays: diffDays };
  } catch (error) {
    console.error('Error calculating job experience:', error);
    return { years: 0, months: 0, totalDays: 0 };
    }
};

// Utility: Check if a job is trainee/intern role (should be ignored for employment gap calculations)
const isTraineeOrIntern = (job) => {
  if (!job) return false;
  
  const title = (job.title || '').toLowerCase();
  const description = (job.work_description || '').toLowerCase();
  
  // Common trainee/intern keywords
  const traineeKeywords = [
    'trainee', 'intern', 'internship', 'apprentice', 'student', 'co-op', 'coop',
    'summer intern', 'winter intern', 'fall intern', 'spring intern',
    'graduate trainee', 'management trainee', 'engineering trainee'
  ];
  
  // Check if title contains trainee/intern keywords
  const hasTraineeTitle = traineeKeywords.some(keyword => title.includes(keyword));
  
  // Check if description contains trainee/intern keywords
  const hasTraineeDescription = traineeKeywords.some(keyword => description.includes(keyword));
  
  // Check if duration is very short (likely internship)
  const jobDuration = calculateExperience(job.work_start_date, job.is_currently_working ? 'Present' : job.work_end_date);
  const isShortDuration = jobDuration.totalDays < 180; // Less than 6 months
  
  return hasTraineeTitle || hasTraineeDescription || isShortDuration;
};

// Utility: Calculate total experience considering overlaps and gaps
const calculateTotalExperience = (workHistory) => {
  try {
    if (!workHistory || workHistory.length === 0) {
      return { years: 0, months: 0, totalDays: 0 };
    }
    
    // Performance optimization: use performance.now() for timing
    const startTime = performance.now();
    
    // Sort work history by start date
    const sortedJobs = [...workHistory].sort((a, b) => {
      const startA = parseDate(a.work_start_date);
      const startB = parseDate(b.work_start_date);
      return startA - startB;
    });
    
    let totalDays = 0;
    const periods = [];
    
    // Process each job
    for (const job of sortedJobs) {
      const startDate = parseDate(job.work_start_date);
      const endDate = job.is_currently_working ? new Date() : parseDate(job.work_end_date);
      
      if (startDate && endDate && startDate < endDate) {
        periods.push({ start: startDate, end: endDate });
      }
    }
    
    // Merge overlapping periods
    const mergedPeriods = [];
    for (const period of periods) {
      if (mergedPeriods.length === 0) {
        mergedPeriods.push(period);
      } else {
        const lastPeriod = mergedPeriods[mergedPeriods.length - 1];
        
        // Check if periods overlap or are adjacent (within 30 days gap)
        const gap = (period.start - lastPeriod.end) / (1000 * 60 * 60 * 24);
        
        if (gap <= 30) {
          // Merge periods
          lastPeriod.end = new Date(Math.max(lastPeriod.end.getTime(), period.end.getTime()));
        } else {
          // Add new period
          mergedPeriods.push(period);
        }
      }
    }
    
    // Calculate total days from merged periods
    for (const period of mergedPeriods) {
      const diffTime = period.end - period.start;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      totalDays += diffDays;
    }
    
    const years = Math.floor(totalDays / 365.25);
    const months = Math.floor((totalDays % 365.25) / 30.44);
    
    const endTime = performance.now();
    console.log(`Experience calculation took ${(endTime - startTime).toFixed(2)}ms`);
    
    return { years, months, totalDays };
  } catch (error) {
    console.error('Error calculating total experience:', error);
    return { years: 0, months: 0, totalDays: 0 };
  }
};

// Utility: Calculate average tenure
const calculateAverageTenure = (workHistory) => {
  try {
    if (!workHistory || workHistory.length === 0) {
      return { years: 0, months: 0 };
    }
    
    let totalTenureDays = 0;
    let validJobs = 0;
    
    for (const job of workHistory) {
      const startDate = parseDate(job.work_start_date);
      const endDate = job.is_currently_working ? new Date() : parseDate(job.work_end_date);
      
      if (startDate && endDate && startDate < endDate) {
        const diffTime = endDate - startDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        totalTenureDays += diffDays;
        validJobs++;
      }
    }
    
    if (validJobs === 0) {
      return { years: 0, months: 0 };
    }
    
    const averageDays = totalTenureDays / validJobs;
    const years = Math.floor(averageDays / 365.25);
    const months = Math.floor((averageDays % 365.25) / 30.44);
    
    return { years, months };
  } catch (error) {
    console.error('Error calculating average tenure:', error);
    return { years: 0, months: 0 };
  }
};

// Top-level header bar with settings button
const Header = ({ onSettingsClick }) => (
  <AppBar position="static" color="primary">
    <Toolbar>
      <Typography variant="h6" sx={{ flexGrow: 1 }}>LLM Resume Parser – built by Saurav</Typography>
      <IconButton color="inherit" onClick={onSettingsClick}>
        <Settings />
      </IconButton>
    </Toolbar>
  </AppBar>
);

// Comparison Resume View Component
const ComparisonResumeView = ({ resume, file, filename }) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        {filename} - Model Comparison
      </Typography>
      <Tabs 
        value={selectedTab} 
        onChange={handleTabChange} 
        sx={{ 
          mb: 2,
          '& .MuiTab-root': {
            minWidth: 'auto',
            textTransform: 'none',
            fontWeight: 'medium'
          }
        }}
        variant="fullWidth"
      >
        {resume.models.map((model, modelIndex) => (
          <Tab 
            key={modelIndex} 
            label={model.modelName} 
            sx={{ 
              textTransform: 'none',
              fontSize: '0.9rem'
            }}
          />
        ))}
      </Tabs>
      {resume.models.map((model, modelIndex) => (
        <Box key={modelIndex} sx={{ display: modelIndex === selectedTab ? 'block' : 'none' }}>
          <ResumeDetails 
            resume={{
              filename: filename,
              data: model.data,
              model: model.model,
              modelName: model.modelName,
              timeMetrics: model.timeMetrics,
              tokenUsage: model.tokenUsage,
              estimatedCost: model.estimatedCost,
              sovrenComparison: model.sovrenComparison,
              error: model.error
            }} 
            file={file}
            isComparisonMode={true}
          />
        </Box>
      ))}
    </Box>
  );
};

// Settings Dialog Component
const SettingsDialog = ({ open, onClose, settings, onSettingsChange }) => {
  const [availableModels, setAvailableModels] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAvailableModels();
    }
  }, [open]);

  // Fallback models if API fails
  const fallbackModels = [
    { id: "openai/gpt-oss-20b", displayName: "GPT-20B" },
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", displayName: "Llama 4 Scout" }
  ];

  const fetchAvailableModels = async () => {
    setLoading(true);
    try {
      console.log('Fetching models from:', 'https://cv-parser-llama.onrender.com/models');
      const response = await axios.get('https://cv-parser-llama.onrender.com/models');
      console.log('Models response:', response.data);
      if (response.data.success) {
        setAvailableModels(response.data.models);
        console.log('Available models set:', response.data.models);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      console.error('Error details:', error.response?.data || error.message);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Model Selection */}
          <FormControl fullWidth>
            <InputLabel>Default Model</InputLabel>
            <Select
              value={settings.selectedModel}
              label="Default Model"
              onChange={(e) => onSettingsChange({ ...settings, selectedModel: e.target.value })}
              disabled={loading}
            >
              {loading ? (
                <MenuItem disabled>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    Loading models...
                  </Box>
                </MenuItem>
              ) : (
                (availableModels.length > 0 ? availableModels : fallbackModels).map((model) => (
                  <MenuItem key={model.id} value={model.id}>
                    {model.displayName}
                  </MenuItem>
                ))
              )}
            </Select>
            {availableModels.length === 0 && !loading && (
              <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                Using fallback models. Check console for connection issues.
              </Typography>
            )}
          </FormControl>

          {/* Comparison Mode Toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={settings.comparisonMode}
                onChange={(e) => onSettingsChange({ ...settings, comparisonMode: e.target.checked })}
              />
            }
            label="Comparison Mode"
          />
          
          {settings.comparisonMode && (
            <Typography variant="body2" color="text.secondary">
              When enabled, resumes will be parsed using both models for comparison.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const ResumeDetails = ({ resume, file, isComparisonMode = false }) => {
  // Debugger for easy debugging
  debugger;
  
  // feedback state
  const [feedbackGiven, setFeedbackGiven]     = useState(false);
  const [showCommentBox, setShowCommentBox]   = useState(false);
  const [commentText, setCommentText]         = useState('');
  const [snackbarOpen, setSnackbarOpen]       = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [experienceLoading, setExperienceLoading] = useState(true);
  const [parsedData, setParsedData] = useState(null);
  const [showEmploymentAnalysis, setShowEmploymentAnalysis] = useState(false);
  const employmentAnalysisRef = useRef(null);

  // Parse resume data and set up experience calculations
  useEffect(() => {
    try {
      const data = JSON.parse(stripCodeFences(resume.data));
      setParsedData(data);
    } catch (error) {
      console.error('Error parsing resume data:', error);
      setParsedData(null);
    }
  }, [resume.data]);

  // whenever a new resume is passed in, clear out any old feedback UI
  useEffect(() => {
    setFeedbackGiven(false);
    setShowCommentBox(false);
    setCommentText('');
  }, [resume.filename]);

  // Memoize experience calculations to avoid recalculation on every render
  const experienceData = useMemo(() => {
    if (!parsedData?.workHistory) {
      return { totalExp: { years: 0, months: 0 }, avgTenure: { years: 0, months: 0 } };
    }

    try {
      setExperienceLoading(true);
      
      console.log('Starting experience calculations for:', parsedData.workHistory);
      
      const totalExp = calculateTotalExperience(parsedData.workHistory);
      const avgTenure = calculateAverageTenure(parsedData.workHistory);
      
      console.log('Experience calculation results:', {
        totalExperience: totalExp,
        averageTenure: avgTenure,
        workHistoryCount: parsedData.workHistory.length,
        workHistory: parsedData.workHistory
      });
      
      setExperienceLoading(false);
      return { totalExp, avgTenure };
    } catch (error) {
      console.error('Error in experience calculation:', error);
      setExperienceLoading(false);
      return { totalExp: { years: 0, months: 0 }, avgTenure: { years: 0, months: 0 } };
    }
  }, [parsedData?.workHistory]);

  // Check for parsing errors
  if (resume.error) {
    return (
      <Card variant="outlined" sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" color="error" gutterBottom>
            Parsing Error - {resume.modelName || 'Unknown Model'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Error: {resume.error}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            The resume could not be parsed by this model. Please try again or use a different model.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // If data is not parsed yet, show loading
  if (!parsedData) {
    return (
      <Card variant="outlined" sx={{ mt: 2 }}>
        <CardContent>
          <CircularProgress />
          <Typography>Loading resume data...</Typography>
        </CardContent>
      </Card>
    );
  }

  const data = parsedData;

  // metrics
  const extractionTime = (resume.timeMetrics.extractionTime / 1000).toFixed(2);
  const llamaTime      = (resume.timeMetrics.llamaTime      / 1000).toFixed(2);
  const totalTime      = (resume.timeMetrics.totalTime      / 1000).toFixed(2);
  const inputTokens    = resume.tokenUsage.prompt_tokens;
  const outputTokens   = resume.tokenUsage.completion_tokens;
  const totalTokens    = resume.tokenUsage.total_tokens;

  // core send function
  const doSend = async (isPositive) => {
    const payload = {
      filename:      resume.filename,
      feedback:      isPositive ? 'up' : 'down',
      comment:       isPositive ? '' : commentText,
      extractionTime,
      llamaTime,
      totalTime,
      inputTokens,
      outputTokens,
      totalTokens
    };

    // attach file on thumbs-down
    if (!isPositive && file) {
      const b64 = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload  = () => resolve(fr.result.split(',')[1]);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      payload.fileBase64 = b64;
    }

    // fire & forget
    fetch(WEBHOOK_URL, {
      method: 'POST',
      mode:   'no-cors',
      body:   JSON.stringify(payload)
    });

    // update UI
    setFeedbackGiven(true);
    setShowCommentBox(false);
    setSnackbarMessage(isPositive
      ? 'Thanks for your feedback! :)'
      : 'Thanks for the feedback - we\'ll look into it.');
    setSnackbarOpen(true);
  };

  return (
    <>
      <Card variant="outlined" sx={{ mt: 2 }}>
        {/* Name / Title / Experience / Feedback */}
        <Box sx={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'flex-start',
          bgcolor:        '#f5f5f5',
          px:             2,
          py:             1
        }}>
          <Box>
            {/* Model indicator removed in comparison mode since it's shown in tabs */}
            <Typography variant="h6">
              {data.firstName} {data.lastName}
            </Typography>
            <Typography variant="subtitle2" color="textSecondary">
              {data.title || 'Title Not Available'} at {data.currentOrganization || 'Current Company Not Available'}
            </Typography>
            <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 0.5 }}>
              Total Experience: {experienceLoading ? (
                <CircularProgress size={12} sx={{ ml: 1 }} />
              ) : (
                `${experienceData.totalExp.years} yrs, ${experienceData.totalExp.months} mos`
              )}
              {/* Model indicator removed in comparison mode since it's shown in tabs */}
            </Typography>
            
            {/* inline contact */}
            <Typography variant="body2" color="textSecondary" sx={{
              mt:         0.5,
              display:    'flex',
              alignItems: 'center',
              flexWrap:   'wrap',
              gap:        1
            }}>
              <Email fontSize="small" /> {data.email || 'Not Available'}
              <Box component="span">|</Box>
              <Phone fontSize="small" /> {data.phone || 'Not Available'}
              <Box component="span">|</Box>
              <LocationOn fontSize="small" /> {data.city || 'Not Available'}{data.fullAddress ? `, ${data.fullAddress}` : ''}
            </Typography>
          </Box>
          <Box>
            <IconButton
              color="success"
              onClick={() => doSend(true)}
              disabled={feedbackGiven}
            >
              <ThumbUp />
            </IconButton>
            <IconButton
              color="error"
              onClick={() => setShowCommentBox(true)}
              disabled={feedbackGiven}
            >
              <ThumbDown />
            </IconButton>
          </Box>
        </Box>

                {/* Experience Analysis Section */}
        <Box sx={{ 
          px: 2, 
          py: 2, 
          borderTop: '1px solid #e0e0e0',
          borderBottom: '1px solid #e0e0e0',
          bgcolor: '#f5f5f5'
        }}>
          <Grid container spacing={2} alignItems="center">
            {/* First Row: Key Metrics with Separators */}
            <Grid item xs={12}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2
              }}>
                {/* Avg Tenure */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessTime fontSize="small" color="action" />
                  <Typography variant="body2" color="textSecondary">
                    Avg Tenure: <strong>{experienceData.avgTenure.years > 0 ? `${experienceData.avgTenure.years}y ` : ''}{experienceData.avgTenure.months}m</strong> per role
                  </Typography>
                </Box>
                
                {/* Separator */}
                <Box component="span" sx={{ color: 'text.disabled' }}>|</Box>
                
                {/* Average Tenure Per Company */}
                {(() => {
                  if (!data.workHistory || data.workHistory.length === 0) return null;
                  
                  // Group jobs by company and calculate average tenure per company
                  const companyGroups = {};
                  data.workHistory.forEach(job => {
                    const companyName = job.work_company_name || 'Unknown Company';
                    if (!companyGroups[companyName]) {
                      companyGroups[companyName] = [];
                    }
                    companyGroups[companyName].push(job);
                  });
                  
                  // Calculate average tenure per company
                  let totalCompanyTenure = 0;
                  let companyCount = 0;
                  
                  Object.values(companyGroups).forEach(companyJobs => {
                    if (companyJobs.length > 0) {
                      const companyTenure = companyJobs.reduce((total, job) => {
                        const jobExperience = calculateExperience(job.work_start_date, job.is_currently_working ? 'Present' : job.work_end_date);
                        return total + (jobExperience.years * 12 + jobExperience.months);
                      }, 0);
                      totalCompanyTenure += companyTenure;
                      companyCount++;
                    }
                  });
                  
                  const avgCompanyTenure = companyCount > 0 ? totalCompanyTenure / companyCount : 0;
                  const avgCompanyYears = Math.floor(avgCompanyTenure / 12);
                  const avgCompanyMonths = Math.floor(avgCompanyTenure % 12);
                  
                  return (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BusinessIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="textSecondary">
                          Avg Company: <strong>{avgCompanyYears > 0 ? `${avgCompanyYears}y ` : ''}{avgCompanyMonths}m</strong> per company
                        </Typography>
                      </Box>
                      
                      {/* Separator */}
                      <Box component="span" sx={{ color: 'text.disabled' }}>|</Box>
                    </>
                  );
                })()}
                
                {/* Experience Summary */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Work fontSize="small" color="action" />
                  <Typography variant="body2" color="textSecondary">
                    <strong>{data.workHistory?.length || 0}</strong> position{data.workHistory?.length !== 1 ? 's' : ''}
                    {(() => {
                      const currentJobs = data.workHistory?.filter(job => job.is_currently_working) || [];
                      return currentJobs.length > 0 ? ` (${currentJobs.length} current)` : '';
                    })()}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            
            {/* Second Row: Employment Analysis Toggle - Only render if there are issues */}
            {(() => {
              if (!data.workHistory || data.workHistory.length === 0) return null;
              
              const sortedJobs = [...data.workHistory].sort((a, b) => {
                const startA = parseDate(a.work_start_date);
                const startB = parseDate(b.work_start_date);
                return startA - startB;
              });
              
              let gaps = [];
              let overlaps = [];
              
              for (let i = 0; i < sortedJobs.length - 1; i++) {
                const currentJob = sortedJobs[i];
                const nextJob = sortedJobs[i + 1];
                
                // Skip trainee/intern roles for gap calculation
                const isCurrentJobTrainee = isTraineeOrIntern(currentJob);
                const isNextJobTrainee = isTraineeOrIntern(nextJob);
                
                const currentEnd = currentJob.is_currently_working ? new Date() : parseDate(currentJob.work_end_date);
                const nextStart = parseDate(nextJob.work_start_date);
                
                if (currentEnd && nextStart) {
                  const gap = (nextStart - currentEnd) / (1000 * 60 * 60 * 24);
                  
                  // Only count gaps if neither job is trainee/intern
                  if (gap > 30 && !isCurrentJobTrainee && !isNextJobTrainee) {
                    gaps.push({
                      from: currentEnd,
                      to: nextStart,
                      days: Math.ceil(gap),
                      fromJob: currentJob,
                      toJob: nextJob
                    });
                  } else if (gap < -1) {
                    overlaps.push({
                      job1: currentJob,
                      job2: nextJob,
                      days: Math.abs(Math.ceil(gap))
                    });
                  }
                }
              }
              
              const hasIssues = gaps.length > 0 || overlaps.length > 0;
              
              return hasIssues ? (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={showEmploymentAnalysis ? <ExpandLess /> : <ExpandMore />}
                      onClick={() => {
                        const newState = !showEmploymentAnalysis;
                        setShowEmploymentAnalysis(newState);
                        if (newState && employmentAnalysisRef.current) {
                          setTimeout(() => {
                            employmentAnalysisRef.current.scrollIntoView({ 
                              behavior: 'smooth', 
                              block: 'start' 
                            });
                          }, 100);
                        }
                      }}
                      sx={{ 
                        textTransform: 'none',
                        color: 'text.secondary',
                        borderColor: '#e0e0e0',
                        '&:hover': {
                          borderColor: 'primary.main',
                          color: 'primary.main'
                        }
                      }}
                    >
                      {gaps.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            bgcolor: 'warning.main',
                            display: 'inline-block'
                          }} />
                          {gaps.length} employment gap{gaps.length > 1 ? 's' : ''} detected
                        </Box>
                      )}
                      {gaps.length > 0 && overlaps.length > 0 && ' & '}
                      {overlaps.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            bgcolor: 'error.main',
                            display: 'inline-block'
                          }} />
                          {overlaps.length} overlap{gaps.length > 1 ? 's' : ''} detected
                        </Box>
                      )}
                    </Button>
                  </Box>
                </Grid>
              ) : null;
            })()}
          </Grid>
        </Box>

        {/* Inline Employment Analysis Details */}
        <div ref={employmentAnalysisRef}>
        {showEmploymentAnalysis && (() => {
          if (!data.workHistory || data.workHistory.length === 0) return null;
          
          const sortedJobs = [...data.workHistory].sort((a, b) => {
            const startA = parseDate(a.work_start_date);
            const startB = parseDate(b.work_start_date);
            return startA - startB;
          });
          
          let gaps = [];
          let overlaps = [];
          
          for (let i = 0; i < sortedJobs.length - 1; i++) {
            const currentJob = sortedJobs[i];
            const nextJob = sortedJobs[i + 1];
            
            const currentEnd = currentJob.is_currently_working ? new Date() : parseDate(currentJob.work_end_date);
            const nextStart = parseDate(nextJob.work_start_date);
            
            if (currentEnd && nextStart) {
              const gap = (nextStart - currentEnd) / (1000 * 60 * 60 * 24);
              
              if (gap > 30) {
                gaps.push({
                  from: currentEnd,
                  to: nextStart,
                  days: Math.ceil(gap),
                  fromJob: currentJob,
                  toJob: nextJob
                });
              } else if (gap < -1) {
                overlaps.push({
                  job1: currentJob,
                  job2: nextJob,
                  days: Math.abs(Math.ceil(gap))
                });
              }
            }
          }
          
          return (
            <Box sx={{ 
              px: 2, 
              py: 1.5, 
              borderTop: '1px solid #e0e0e0',
              bgcolor: '#f8f9fa'
            }}>
              {/* Employment Gaps */}
              {gaps.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      bgcolor: 'warning.main'
                    }} />
                    Employment Gaps ({gaps.length})
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', fontStyle: 'italic' }}>
                    Note: Only significant employment gaps between professional roles are shown. Internships and trainee positions are excluded.
                  </Typography>
                  {gaps.map((gap, index) => {
                    const formatDate = (date) => date.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    });
                    
                    const gapYears = Math.floor(gap.days / 365.25);
                    const gapMonths = Math.floor((gap.days % 365.25) / 30.44);
                    
                    return (
                      <Paper key={index} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="body2" fontWeight="medium">
                            Gap {index + 1}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {gapYears > 0 ? `${gapYears}y ` : ''}{gapMonths}m ({gap.days} days)
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          <strong>From:</strong> {gap.fromJob.title} at {gap.fromJob.work_company_name} 
                          ({formatDate(gap.from)})
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>To:</strong> {gap.toJob.title} at {gap.toJob.work_company_name} 
                          ({formatDate(gap.to)})
                        </Typography>
                      </Paper>
                    );
                  })}
                </Box>
              )}
              
              {/* Employment Overlaps */}
              {overlaps.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      bgcolor: 'error.main'
                    }} />
                    Overlapping Employment ({overlaps.length})
                  </Typography>
                  {overlaps.map((overlap, index) => {
                    const overlapYears = Math.floor(overlap.days / 365.25);
                    const overlapMonths = Math.floor((overlap.days % 365.25) / 30.44);
                    
                    return (
                      <Paper key={index} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="body2" fontWeight="medium">
                            Overlap {index + 1}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {overlapYears > 0 ? `${overlapYears}y ` : ''}{overlapMonths}m ({overlap.days} days)
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          <strong>Job 1:</strong> {overlap.job1.title} at {overlap.job1.work_company_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Job 2:</strong> {overlap.job2.title} at {overlap.job2.work_company_name}
                        </Typography>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Box>
          );
        })()}
        </div>

        <CardContent sx={{ px: 2, py: 1 }}>
          {/* comment textarea only on thumbs-down */}
          {showCommentBox && !feedbackGiven && (
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="What didn't work?"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
              />
              <Box sx={{ textAlign: 'right', mt: 1 }}>
                <Button
                  variant="contained"
                  color="error"
                  onClick={() => doSend(false)}
                  disabled={!commentText.trim()}
                >
                  Send Feedback
                </Button>
              </Box>
            </Box>
          )}

          {/* summary */}
          {data.summary && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              {data.summary}
            </Typography>
          )}

          <Grid container spacing={2}>
            {/* Work History */}
            <Grid item xs={12} md={8}>
              <Typography variant="subtitle2" sx={{ display:'flex', alignItems:'center', mb:1 }}>
                <Work fontSize="small" sx={{ mr:0.5 }} /> Work History
              </Typography>
              <Paper variant="outlined" sx={{ p:2, mb:2 }}>
                {data.workHistory?.map((job, i) => {
                  // Calculate individual job experience
                  const jobExperience = calculateExperience(job.work_start_date, job.is_currently_working ? 'Present' : job.work_end_date);
                  const endLabel = job.is_currently_working
                    ? 'Present'
                    : (job.work_end_date || 'End Date Unavailable');

                  // Validate experience calculation
                  const isValidExperience = jobExperience.years >= 0 && jobExperience.months >= 0;
                  
                  return (
                    <Box key={i} sx={{ mb:2, p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {job.title} at {job.work_company_name || 'Not Available'}
                      </Typography>
                      <Typography variant="caption" display="block" gutterBottom>
                        {job.work_start_date || 'Start Date Unavailable'} – {endLabel}
                        <Box component="span" sx={{ 
                          ml: 1, 
                          color: isValidExperience ? 'primary.main' : 'error.main', 
                          fontWeight: 'bold',
                          fontSize: '0.75rem'
                        }}>
                          ({isValidExperience ? 
                            `${jobExperience.years > 0 ? `${jobExperience.years}y ` : ''}${jobExperience.months}m` : 
                            'Invalid dates'
                          })
                        </Box>
                      </Typography>
                      <Typography variant="body2">{job.work_description}</Typography>
                      
                      {/* Show validation warnings */}
                      {!isValidExperience && (
                        <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                          ⚠️ Date validation issue detected
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Paper>
              
              {/* Education */}
              <Typography variant="subtitle2" sx={{ display:'flex', alignItems:'center', mb:1 }}>
                <School fontSize="small" sx={{ mr:0.5 }} /> Education
              </Typography>
              <Paper variant="outlined" sx={{ p:2 }}>
                {data.educationHistory?.map((edu, i) => (
                  <Box key={i} sx={{ mb:2 }}>
                    <Typography variant="body2" fontWeight="bold">
                      {edu.institute_name}
                    </Typography>
                    <Typography variant="caption" display="block">
                      {edu.educational_qualification} {edu.educational_specialization}
                    </Typography>
                    <Typography variant="caption" display="block">
                      {edu.education_start_date || 'Start Date Unavailable'} – {edu.education_end_date || 'End Date Unavailable'}
                    </Typography>
                    <Typography variant="body2" sx={{ mt:1 }}>
                      {edu.education_description}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>

            {/* Skills & Social Media */}
            <Grid item xs={12} md={4}>
              {/* Skills */}
              <Typography variant="subtitle2" sx={{ display:'flex', alignItems:'center', mb:1 }}>
                <Category fontSize="small" sx={{ mr:0.5 }} /> Skills
              </Typography>
              <Box sx={{ mb:2 }}>
                {data.skills?.map((skill, i) => (
                  <Chip
                    key={i}
                    label={typeof skill === 'string' ? skill : skill.tech_skill}
                    size="small"
                    sx={{ mr:0.5, mb:0.5 }}
                  />
                ))}
              </Box>
              <Divider sx={{ my:2 }} />

              {/* Social Media */}
              <Typography variant="subtitle2" sx={{ display:'flex', alignItems:'center', mb:1 }}>
                <EmojiPeople fontSize="small" sx={{ mr:0.5 }} /> Social Media
              </Typography>
              <List dense>
                {['linkedin','github','twitter','facebook'].map(key => {
                  const Icon = {
                    linkedin: LinkedInIcon,
                    github:   GitHubIcon,
                    twitter:  TwitterIcon,
                    facebook: FacebookIcon
                  }[key];
                  const url = data.socialMedia[key];
                  return (
                    <ListItem key={key} sx={{ px:0 }}>
                      <ListItemIcon sx={{ minWidth:'auto', mr:1 }}>
                        <Icon fontSize="small" color="action" />
                      </ListItemIcon>
                      <ListItemText primary={
                        url
                          ? <Link href={url.startsWith('http') ? url : `https://${url}`} target="_blank" underline="hover">
                              {url}
                            </Link>
                          : 'Not Available'
                      }/>
                    </ListItem>
                  );
                })}
              </List>
            </Grid>
          </Grid>
        </CardContent>
        

      </Card>

      {/* Feedback Snackbar */}
      <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={()=>setSnackbarOpen(false)}>
        <Alert onClose={()=>setSnackbarOpen(false)} severity="success" sx={{ width:'100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

const UploadResume = () => {
  // Debugger for easy debugging
  debugger;
  
  const [files, setFiles]             = useState([]);
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [clientTime, setClientTime]   = useState(null);
  const [costMetricsExpanded, setCostMetricsExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    selectedModel: "openai/gpt-oss-20b", // Default to GPT-20B
    comparisonMode: false
  });

  const onChange = e => setFiles(Array.from(e.target.files));

  const onUpload = async () => {
    if (!files.length) return;
    setLoading(true);
    const start = Date.now();
    const fd    = new FormData();
    files.forEach(f => fd.append('resumes', f));
    
    // Add settings to form data
    fd.append('modelId', settings.selectedModel);
    fd.append('comparisonMode', settings.comparisonMode);
    
    try {
      const endpoint = settings.comparisonMode ? '/upload/compare' : '/upload';
      const url = `https://cv-parser-llama.onrender.com${endpoint}`;
      console.log('Uploading to:', url);
      console.log('Settings:', { modelId: settings.selectedModel, comparisonMode: settings.comparisonMode });
      
      const res = await axios.post(url, fd, { headers: { 'Content-Type':'multipart/form-data' } });
      console.log('Upload response:', res.data);
      setResult(res.data);
      setClientTime(((Date.now()-start)/1000).toFixed(2));
    } catch (error) {
      console.error('Error parsing resumes:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      let errorMessage = 'Error parsing resumes';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      alert(errorMessage);
    }
    setLoading(false);
  };

  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings);
  };

  return (
    <>
      <Header onSettingsClick={() => setSettingsOpen(true)} />
      <Container maxWidth="lg" sx={{ mt:2, mb:2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p:2, mb:2 }}>
              <Typography variant="h6" gutterBottom>Upload Resumes</Typography>
              
              {/* Model Selection Display */}
              <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Current Model: {settings.selectedModel === "openai/gpt-oss-20b" ? "GPT-20B" : "Llama 4 Scout"}
                </Typography>
                {settings.comparisonMode && (
                  <Typography variant="caption" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CompareArrows fontSize="small" />
                    Comparison Mode Active
                  </Typography>
                )}
              </Box>
              
              <Stack spacing={1}>
                <Button variant="contained" component="label" startIcon={<CloudUpload />}>
                  Choose Files
                  <input type="file" hidden multiple accept=".pdf,.doc,.docx" onChange={onChange}/>
                </Button>
                <Button variant="contained" color="secondary" onClick={onUpload} disabled={loading}>
                  {loading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={20}/>
                      {settings.comparisonMode ? 'Parsing with both models...' : 'Parsing...'}
                    </Box>
                  ) : (
                    settings.comparisonMode ? 'Parse & Compare' : 'Parse'
                  )}
                </Button>
              </Stack>
              {files.length>0 && (
                <List dense>
                  {files.map((f,i)=>(
                    <Tooltip 
                      key={i} 
                      title={f.name} 
                      placement="top-start"
                      enterDelay={500}
                    >
                      <ListItem sx={{ wordBreak: 'break-word' }}>
                        <ListItemText 
                          primary={f.name} 
                          primaryTypographyProps={{
                            sx: { 
                              fontSize: '0.875rem',
                              lineHeight: 1.2,
                              wordBreak: 'break-word',
                              maxWidth: '100%'
                            }
                          }}
                        />
                      </ListItem>
                    </Tooltip>
                  ))}
                </List>
              )}
            </Paper>

            {result?.resumes?.[0] && (
              <Paper sx={{ p:2, mb:2 }}>
                <Typography variant="subtitle2" gutterBottom>Time Metrics</Typography>
                <List dense>
                  {(() => {
                    if (settings.comparisonMode && result.resumes[0].models) {
                      // Comparison mode - show metrics for each model
                      return result.resumes[0].models.map((model, index) => (
                        <Box key={index} sx={{ mb: 2 }}>
                          <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
                            {model.modelName}
                          </Typography>
                          {[
                            ['LLAMA Time',`${(model.timeMetrics.llamaTime/1000).toFixed(2)}s`],
                            ['Total Backend Time',`${(model.timeMetrics.totalTime/1000).toFixed(2)}s`]
                          ].map(([p,s],i)=>(
                            <ListItem key={i} sx={{ pl: 2 }}>
                              <ListItemIcon sx={{ minWidth:'auto', mr:0.5 }}>
                                <AccessTime fontSize="small"/>
                              </ListItemIcon>
                              <ListItemText primary={p} secondary={s}/>
                            </ListItem>
                          ))}
                        </Box>
                      ));
                    } else {
                      // Single model mode
                      return [
                        ['Client-side Time',`${clientTime}s`],
                        ['Extraction Time',`${(result.resumes[0].timeMetrics.extractionTime/1000).toFixed(2)}s`],
                        ['LLAMA Time',`${(result.resumes[0].timeMetrics.llamaTime/1000).toFixed(2)}s`],
                        ['Total Backend Time',`${(result.resumes[0].timeMetrics.totalTime/1000).toFixed(2)}s`]
                      ].map(([p,s],i)=>(
                        <ListItem key={i}>
                          <ListItemIcon sx={{ minWidth:'auto', mr:0.5 }}>
                            <AccessTime fontSize="small"/>
                          </ListItemIcon>
                          <ListItemText primary={p} secondary={s}/>
                        </ListItem>
                      ));
                    }
                  })()}
                </List>
              </Paper>
            )}

            {result?.resumes?.[0] && (
              <Paper sx={{ p:2}}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ mb: 0 }}>Cost Metrics</Typography>
                  <IconButton
                    size="small"
                    onClick={() => setCostMetricsExpanded(!costMetricsExpanded)}
                    sx={{ transform: costMetricsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                  >
                    <ExpandMore />
                  </IconButton>
                </Box>
                <Collapse in={costMetricsExpanded}>
                  {(() => {
                    if (settings.comparisonMode && result.resumes[0].models) {
                      // Comparison mode - show costs for each model
                      return result.resumes[0].models.map((model, index) => (
                        <Box key={index} sx={{ mb: 2 }}>
                          <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
                            {model.modelName}
                          </Typography>
                          <List dense>
                            <ListItem><ListItemText primary="LLAMA Cost"   secondary={`$${model.estimatedCost}`}/></ListItem>
                            <ListItem><ListItemText primary="Sovren Cost"  secondary={`$${model.sovrenComparison.sovrenCost.toFixed(4)}`}/></ListItem>
                            <ListItem><ListItemText primary="Savings"      secondary={`$${model.sovrenComparison.savings} (${model.sovrenComparison.savingsPercentage}%)`}/></ListItem>
                          </List>
                        </Box>
                      ));
                    } else {
                      // Single model mode
                      return (
                        <List dense>
                          <ListItem><ListItemText primary="LLAMA Cost"   secondary={`$${result.resumes[0].estimatedCost}`}/></ListItem>
                          <ListItem><ListItemText primary="Sovren Cost"  secondary={`$${result.resumes[0].sovrenComparison.sovrenCost.toFixed(4)}`}/></ListItem>
                          <ListItem><ListItemText primary="Savings"      secondary={`$${result.resumes[0].sovrenComparison.savings} (${result.resumes[0].sovrenComparison.savingsPercentage}%)`}/></ListItem>
                        </List>
                      );
                    }
                  })()}
                </Collapse>
              </Paper>
            )}
          </Grid>
          <Grid item xs={12} md={9}>
            {result?.resumes.map((r,i)=>{
              if (settings.comparisonMode && r.models) {
                // Comparison mode - show results from both models
                return (
                  <ComparisonResumeView 
                    key={i} 
                    resume={r} 
                    file={files[i]} 
                    filename={r.filename}
                  />
                );
              } else {
                // Single model mode
                return <ResumeDetails key={i} resume={r} file={files[i]} isComparisonMode={false} />;
              }
            })}
          </Grid>
        </Grid>
      </Container>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />
    </>
  );
};

export default UploadResume;

// Test function for experience calculations (remove in production)
export const testExperienceCalculations = () => {
  console.log('Testing experience calculations...');
  
  // Test data
  const testWorkHistory = [
    {
      title: 'Software Engineer',
      work_company_name: 'Test Company 1',
      work_start_date: '2020-01-01',
      work_end_date: '2022-01-01',
      is_currently_working: false
    },
    {
      title: 'Senior Developer',
      work_company_name: 'Test Company 2',
      work_start_date: '2022-02-01',
      work_end_date: '2024-01-01',
      is_currently_working: false
    },
    {
      title: 'Lead Developer',
      work_company_name: 'Test Company 3',
      work_start_date: '2024-02-01',
      work_end_date: 'Present',
      is_currently_working: true
    }
  ];
  
  // Test individual experience calculation
  const job1Exp = calculateExperience('2020-01-01', '2022-01-01');
  console.log('Job 1 experience:', job1Exp);
  
  // Test total experience calculation
  const totalExp = calculateTotalExperience(testWorkHistory);
  console.log('Total experience:', totalExp);
  
  // Test average tenure calculation
  const avgTenure = calculateAverageTenure(testWorkHistory);
  console.log('Average tenure:', avgTenure);
  
  // Test date parsing
  console.log('Date parsing tests:');
  console.log('2020-01-01 ->', parseDate('2020-01-01'));
  console.log('01/2020 ->', parseDate('01/2020'));
  console.log('2020 ->', parseDate('2020'));
  console.log('Present ->', parseDate('Present'));
  
  return { job1Exp, totalExp, avgTenure };
};
