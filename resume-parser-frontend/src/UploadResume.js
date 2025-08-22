// src/UploadResume.js

import React, { useState, useEffect } from 'react';
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

// Top-level header bar
const Header = () => (
  <AppBar position="static" color="primary">
    <Toolbar>
      <Typography variant="h6">LLM Resume Parser – built by Saurav</Typography>
    </Toolbar>
  </AppBar>
);

const ResumeDetails = ({ resume, file }) => {
  // feedback state
  const [feedbackGiven, setFeedbackGiven]     = useState(false);
  const [showCommentBox, setShowCommentBox]   = useState(false);
  const [commentText, setCommentText]         = useState('');
  const [snackbarOpen, setSnackbarOpen]       = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // whenever a new resume is passed in, clear out any old feedback UI
  useEffect(() => {
    setFeedbackGiven(false);
    setShowCommentBox(false);
    setCommentText('');
  }, [resume.filename]);

  let data;
  try {
    data = JSON.parse(stripCodeFences(resume.data));
  } catch {
    return null;
  }

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
      : 'Thanks for the feedback — we’ll look into it.');
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
              Total Experience: {data.workExperience.years} yrs, {data.workExperience.months} mos
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
      // NEW ➜ decide what to show after the dash
      const endLabel = job.is_currently_working
        ? 'Present'
        : (job.work_end_date || 'End Date Unavailable');

      return (
        <Box key={i} sx={{ mb:2 }}>
          <Typography variant="body2" fontWeight="bold">
            {job.title} at {job.work_company_name || 'Not Available'}
          </Typography>
          <Typography variant="caption" display="block" gutterBottom>
            {job.work_start_date || 'Start Date Unavailable'} – {endLabel}
          </Typography>
          <Typography variant="body2">{job.work_description}</Typography>
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