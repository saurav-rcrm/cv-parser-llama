// src/UploadResumeFixed.js

import React, { useState, useEffect, useMemo } from 'react';
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
  Collapse
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
  ExpandLess
} from '@mui/icons-material';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import GitHubIcon   from '@mui/icons-material/GitHub';
import TwitterIcon  from '@mui/icons-material/Twitter';
import FacebookIcon from '@mui/icons-material/Facebook';
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

// Top-level header bar
const Header = () => (
  <AppBar position="static" color="primary">
    <Toolbar>
      <Typography variant="h6">LLM Resume Parser – built by Saurav</Typography>
    </Toolbar>
  </AppBar>
);

const ResumeDetails = ({ resume, file }) => {
  // Debugger for easy debugging
  debugger;
  
  // feedback state
  const [feedbackGiven, setFeedbackGiven]     = useState(false);
  const [showCommentBox, setShowCommentBox]   = useState(false);
  const [commentText, setCommentText]         = useState('');
  const [snackbarOpen, setSnackbarOpen]       = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [experienceLoading, setExperienceLoading] = useState(true);

  // whenever a new resume is passed in, clear out any old feedback UI
  useEffect(() => {
    setFeedbackGiven(false);
    setShowCommentBox(false);
    setCommentText('');
  }, [resume.filename]);

  // Parse resume data first
  let data;
  try {
    data = JSON.parse(stripCodeFences(resume.data));
  } catch {
    return null;
  }

  // Memoize experience calculations to avoid recalculation on every render
  const experienceData = useMemo(() => {
    try {
      setExperienceLoading(true);
      
      console.log('Starting experience calculations for:', data?.workHistory);
      
      const totalExp = calculateTotalExperience(data?.workHistory);
      const avgTenure = calculateAverageTenure(data?.workHistory);
      
      console.log('Experience calculation results:', {
        totalExperience: totalExp,
        averageTenure: avgTenure,
        workHistoryCount: data?.workHistory?.length || 0,
        workHistory: data?.workHistory
      });
      
      setExperienceLoading(false);
      return { totalExp, avgTenure };
    } catch (error) {
      console.error('Error in experience calculation:', error);
      setExperienceLoading(false);
      return { totalExp: { years: 0, months: 0 }, avgTenure: { years: 0, months: 0 } };
    }
  }, [data?.workHistory]);

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
      : 'Thanks for the feedback — we'll look into it.');
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
            </Typography>
            
            {/* Average Tenure Highlight */}
            {experienceData.avgTenure.years > 0 || experienceData.avgTenure.months > 0 ? (
              <Typography variant="body2" sx={{ 
                mt: 1, 
                p: 1, 
                bgcolor: 'primary.light', 
                color: 'white', 
                borderRadius: 1,
                display: 'inline-block'
              }}>
                📊 Avg Tenure: {experienceData.avgTenure.years > 0 ? `${experienceData.avgTenure.years}y ` : ''}{experienceData.avgTenure.months}m per role
              </Typography>
            ) : null}
            
            {/* Employment Analysis */}
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
                
                const currentEnd = currentJob.is_currently_working ? new Date() : parseDate(currentJob.work_end_date);
                const nextStart = parseDate(nextJob.work_start_date);
                
                if (currentEnd && nextStart) {
                  const gap = (nextStart - currentEnd) / (1000 * 60 * 60 * 24);
                  
                  if (gap > 30) {
                    gaps.push({
                      from: currentEnd,
                      to: nextStart,
                      days: Math.ceil(gap)
                    });
                  } else if (gap < -1) {
                    overlaps.push({
                      job1: currentJob.title,
                      job2: nextJob.title,
                      days: Math.abs(Math.ceil(gap))
                    });
                  }
                }
              }
              
              return (
                <Box sx={{ mt: 1 }}>
                  {/* Experience Summary */}
                  <Typography variant="caption" sx={{ 
                    display: 'block', 
                    color: 'info.main',
                    bgcolor: 'info.light',
                    p: 0.5,
                    borderRadius: 0.5,
                    mb: 0.5
                  }}>
                    📋 {data.workHistory.length} position{data.workHistory.length > 1 ? 's' : ''} • 
                    {(() => {
                      const currentJobs = data.workHistory.filter(job => job.is_currently_working);
                      return currentJobs.length > 0 ? ` ${currentJobs.length} current` : '';
                    })()}
                  </Typography>
                  
                  {gaps.length > 0 && (
                    <Typography variant="caption" sx={{ 
                      display: 'block', 
                      color: 'warning.main',
                      bgcolor: 'warning.light',
                      p: 0.5,
                      borderRadius: 0.5,
                      mb: 0.5
                    }}>
                      ⚠️ {gaps.length} employment gap{gaps.length > 1 ? 's' : ''} detected
                    </Typography>
                  )}
                  {overlaps.length > 0 && (
                    <Typography variant="caption" sx={{ 
                      display: 'block', 
                      color: 'error.main',
                      bgcolor: 'error.light',
                      p: 0.5,
                      borderRadius: 0.5
                    }}>
                      ⚠️ {overlaps.length} overlapping employment period{overlaps.length > 1 ? 's' : ''} detected
                    </Typography>
                  )}
                </Box>
              );
            })()}
            
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

  const onChange = e => setFiles(Array.from(e.target.files));

  const onUpload = async () => {
    if (!files.length) return;
    setLoading(true);
    const start = Date.now();
    const fd    = new FormData();
    files.forEach(f => fd.append('resumes', f));
    try {
      const res = await axios.post(
        'https://cv-parser-llama.onrender.com/upload',
        fd,
        { headers: { 'Content-Type':'multipart/form-data' } }
      );
      setResult(res.data);
      setClientTime(((Date.now()-start)/1000).toFixed(2));
    } catch {
      alert('Error parsing resumes');
    }
    setLoading(false);
  };

  return (
    <>
      <Header/>
      <Container maxWidth="lg" sx={{ mt:2, mb:2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p:2, mb:2 }}>
              <Typography variant="h6" gutterBottom>Upload Resumes</Typography>
              <Stack spacing={1}>
                <Button variant="contained" component="label" startIcon={<CloudUpload />}>
                  Choose Files
                  <input type="file" hidden multiple accept=".pdf,.doc,.docx" onChange={onChange}/>
                </Button>
                <Button variant="contained" color="secondary" onClick={onUpload} disabled={loading}>
                  {loading ? <CircularProgress size={20}/> : 'Parse'}
                </Button>
              </Stack>
              {files.length>0 && (
                <List dense>
                  {files.map((f,i)=><ListItem key={i}><ListItemText primary={f.name}/></ListItem>)}
                </List>
              )}
            </Paper>

            {result?.resumes?.[0] && (
              <Paper sx={{ p:2, mb:2 }}>
                <Typography variant="subtitle2" gutterBottom>Time Metrics</Typography>
                <List dense>
                  {[
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
                  ))}
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
                  <List dense>
                    <ListItem><ListItemText primary="LLAMA Cost"   secondary={`$${result.resumes[0].estimatedCost}`}/></ListItem>
                    <ListItem><ListItemText primary="Sovren Cost"  secondary={`$${result.resumes[0].sovrenComparison.sovrenCost.toFixed(4)}`}/></ListItem>
                    <ListItem><ListItemText primary="Savings"      secondary={`$${result.resumes[0].sovrenComparison.savings} (${result.resumes[0].sovrenComparison.savingsPercentage}%)`}/></ListItem>
                  </List>
                </Collapse>
              </Paper>
            )}
          </Grid>
          <Grid item xs={12} md={9}>
            {result?.resumes.map((r,i)=><ResumeDetails key={i} resume={r} file={files[i]}/> )}
          </Grid>
        </Grid>
      </Container>
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
