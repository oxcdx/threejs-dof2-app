const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = 8080;

// Enable CORS for all routes
app.use(cors());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve the uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/uploads'));
  },
  filename: (req, file, cb) => {
    const now = new Date();
    const timestamp = now.toISOString().split('.')[0].replace(/:/g, '-');
    const originalName = file.originalname.replace(/\s+/g, '_');
    const newFilename = `${timestamp}-${originalName}`;
    cb(null, newFilename);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg') {
      cb(null, true);
    } else {
      cb(new Error('Only JPG or JPEG files are allowed.'));
    }
  },
});

// Handle file uploads
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const uploadedFilePath = path.join(__dirname, 'public/uploads', req.file.filename);
  const folderName = path.parse(req.file.filename).name; // Get the filename without extension
  const folderPath = path.join(__dirname, 'public/uploads', folderName);
  const depthFolderPath = path.join(folderPath, 'depth');

  try {
    // Create the folder and depth subfolder
    fs.mkdirSync(folderPath, { recursive: true });
    fs.mkdirSync(depthFolderPath, { recursive: true });

    // Move the uploaded file into the folder
    const newFilePath = path.join(folderPath, req.file.filename);
    fs.renameSync(uploadedFilePath, newFilePath);

    // Run MiDaS to generate the depth map
    const condaActivate = `conda activate midas-py310`;
    const midasCommand = `python run.py --model_type dpt_beit_large_512 --input_path ${folderPath} --output_path ${depthFolderPath}`;

    
    const fullCommand = `${condaActivate} && ${midasCommand}`;

    exec(fullCommand, { cwd: path.join(__dirname, 'MiDaS') }, (error, stdout, stderr) => {
      if (error) {
        console.error('Error running MiDaS:', error);
        console.error('MiDaS stderr:', stderr);

        // Check if the depth map was generated despite the error
        const depthMapFilePath = path.join(depthFolderPath, `${folderName}-dpt_beit_large_512.png`);
        if (fs.existsSync(depthMapFilePath)) {
          console.warn('MiDaS encountered an error, but the depth map was generated.');

          // Respond with the paths to the original image and the depth map
          return res.json({
            originalImage: `/uploads/${folderName}/${req.file.filename}`,
            depthMap: `/uploads/${folderName}/depth/${folderName}-dpt_beit_large_512.png`,
          });
        }

        // If no depth map was generated, return an error
        return res.status(500).json({ error: 'Error processing image with MiDaS.' });
      }

      console.log('MiDaS output:', stdout);

      // Check if the depth map was generated
      const depthMapFilePath = path.join(depthFolderPath, `${folderName}-dpt_beit_large_512.png`);
      if (!fs.existsSync(depthMapFilePath)) {
        console.error('Depth map not found:', depthMapFilePath);
        return res.status(500).json({ error: 'Depth map generation failed.' });
      }

      // Respond with the paths to the original image and the depth map
      res.json({
        originalImage: `/uploads/${folderName}/${req.file.filename}`,
        depthMap: `/uploads/${folderName}/depth/${folderName}-dpt_beit_large_512.png`,
      });
    });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});