const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { exec } = require('child_process');
const sharp = require('sharp');

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
  const folderName = path.parse(req.file.filename).name;
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
    const midasCommand = `python run.py --model_type dpt_swin2_large_384 --input_path ${folderPath} --output_path ${depthFolderPath} --height 384`;
    
    const fullCommand = `${condaActivate} && ${midasCommand}`;

    exec(fullCommand, { cwd: path.join(__dirname, 'MiDaS') }, async (error, stdout, stderr) => {
      if (error) {
        console.error('Error running MiDaS:', error);
        console.error('MiDaS stderr:', stderr);

        // Check if the depth map was generated despite the error
        const depthMapFilePath = path.join(depthFolderPath, `${folderName}-dpt_swin2_large_384.png`);
        if (fs.existsSync(depthMapFilePath)) {
          console.warn('MiDaS encountered an error, but the depth map was generated.');

          // Create a new skybox folder
          const skyboxFolderName = `${folderName}-skybox`;
          const skyboxFolderPath = path.join(__dirname, 'public', 'textures', 'cube', skyboxFolderName);
          fs.mkdirSync(skyboxFolderPath, { recursive: true });
          
          try {
            // Get image dimensions
            const metadata = await sharp(depthMapFilePath).metadata();
            const { width, height } = metadata;
            
            // Determine crop dimensions (to make it square)
            const size = Math.min(width, height);
            const left = Math.floor((width - size) / 2);
            const top = Math.floor((height - size) / 2);
            
            // Crop and save as negx.jpg and posx.jpg
            await sharp(depthMapFilePath)
              .extract({ left, top, width: size, height: size })
              .toFormat('jpeg')
              .toFile(path.join(skyboxFolderPath, 'negx.jpg'));
              
            await sharp(depthMapFilePath)
              .extract({ left, top, width: size, height: size })
              .toFormat('jpeg')
              .toFile(path.join(skyboxFolderPath, 'posx.jpg'));
            
            // Copy or create black images for the other sides
            const blackJpgPath = path.join(__dirname, 'public', 'textures', 'cube', 'black.jpg');
            
            if (fs.existsSync(blackJpgPath)) {
              // Copy the black.jpg file to the other sides
              fs.copyFileSync(blackJpgPath, path.join(skyboxFolderPath, 'posz.jpg'));
              fs.copyFileSync(blackJpgPath, path.join(skyboxFolderPath, 'negz.jpg'));
              fs.copyFileSync(blackJpgPath, path.join(skyboxFolderPath, 'posy.jpg'));
              fs.copyFileSync(blackJpgPath, path.join(skyboxFolderPath, 'negy.jpg'));
            } else {
              // Create black images if black.jpg doesn't exist
              const blackImage = {
                create: {
                  width: size,
                  height: size,
                  channels: 3,
                  background: { r: 0, g: 0, b: 0 }
                }
              };
              
              await sharp(blackImage).jpeg().toFile(path.join(skyboxFolderPath, 'posz.jpg'));
              await sharp(blackImage).jpeg().toFile(path.join(skyboxFolderPath, 'negz.jpg'));
              await sharp(blackImage).jpeg().toFile(path.join(skyboxFolderPath, 'posy.jpg'));
              await sharp(blackImage).jpeg().toFile(path.join(skyboxFolderPath, 'negy.jpg'));
            }
            
            // RESPONSE #1: Send response with skybox info
            return res.json({
              originalImage: `/uploads/${folderName}/${req.file.filename}`,
              depthMap: `/uploads/${folderName}/depth/${folderName}-dpt_swin2_large_384.png`,
              skyboxPath: `/textures/cube/${skyboxFolderName}/`
            });
            
          } catch (imageError) {
            console.error('Error processing depth map for skybox:', imageError);
            // RESPONSE #2: Send response without skybox info
            return res.json({
              originalImage: `/uploads/${folderName}/${req.file.filename}`,
              depthMap: `/uploads/${folderName}/depth/${folderName}-dpt_swin2_large_384.png`
            });
          }

          // THIS BLOCK IS THE ISSUE - DON'T ATTEMPT TO SEND ANOTHER RESPONSE AFTER THE TRY/CATCH ABOVE
          // DON'T DO THIS - Already responded above
          // return res.json({
          //   originalImage: `/uploads/${folderName}/${req.file.filename}`,
          //   depthMap: `/uploads/${folderName}/depth/${folderName}-dpt_swin2_large_384.png`,
          // });
        } else {
          // RESPONSE #3: If no depth map was generated, return an error
          // ⚠️ FIXED: Added 'else' to ensure this only runs if condition above is false
          return res.status(500).json({ error: 'Error processing image with MiDaS.' });
        }
      }

      console.log('MiDaS output:', stdout);

      // Check if the depth map was generated
      const depthMapFilePath = path.join(depthFolderPath, `${folderName}-dpt_swin2_large_384.png`);
      if (!fs.existsSync(depthMapFilePath)) {
        console.error('Depth map not found:', depthMapFilePath);
        return res.status(500).json({ error: 'Depth map generation failed.' });
      }

      // RESPONSE #4: Normal successful case
      return res.json({
        originalImage: `/uploads/${folderName}/${req.file.filename}`,
        depthMap: `/uploads/${folderName}/depth/${folderName}-dpt_swin2_large_384.png`,
      });
    });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});
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
    const midasCommand = `python run.py --model_type dpt_swin2_large_384 --input_path ${folderPath} --output_path ${depthFolderPath} --height 384`;

    
    const fullCommand = `${condaActivate} && ${midasCommand}`;

    exec(fullCommand, { cwd: path.join(__dirname, 'MiDaS') }, async (error, stdout, stderr) => {
      if (error) {
        console.error('Error running MiDaS:', error);
        console.error('MiDaS stderr:', stderr);

        // Check if the depth map was generated despite the error
        const depthMapFilePath = path.join(depthFolderPath, `${folderName}-dpt_swin2_large_384.png`);
        if (fs.existsSync(depthMapFilePath)) {
          console.warn('MiDaS encountered an error, but the depth map was generated.');

          // Create a new skybox folder
          const skyboxFolderName = `${folderName}-skybox`;
          const skyboxFolderPath = path.join(__dirname, 'public', 'textures', 'cube', skyboxFolderName);
          fs.mkdirSync(skyboxFolderPath, { recursive: true });
          
          try {
            // Get image dimensions
            const metadata = await sharp(depthMapFilePath).metadata();
            const { width, height } = metadata;
            
            // Determine crop dimensions (to make it square)
            const size = Math.min(width, height);
            const left = Math.floor((width - size) / 2);
            const top = Math.floor((height - size) / 2);
            
            // Crop and save as negx.jpg and posx.jpg
            await sharp(depthMapFilePath)
              .extract({ left, top, width: size, height: size })
              .toFormat('jpeg')
              .toFile(path.join(skyboxFolderPath, 'negx.jpg'));
              
            await sharp(depthMapFilePath)
              .extract({ left, top, width: size, height: size })
              .toFormat('jpeg')
              .toFile(path.join(skyboxFolderPath, 'posx.jpg'));
            
            // Copy or create black images for the other sides
            const blackJpgPath = path.join(__dirname, 'public', 'textures', 'cube', 'black.jpg');
            
            if (fs.existsSync(blackJpgPath)) {
              // Copy the black.jpg file to the other sides
              fs.copyFileSync(blackJpgPath, path.join(skyboxFolderPath, 'posz.jpg'));
              fs.copyFileSync(blackJpgPath, path.join(skyboxFolderPath, 'negz.jpg'));
              fs.copyFileSync(blackJpgPath, path.join(skyboxFolderPath, 'posy.jpg'));
              fs.copyFileSync(blackJpgPath, path.join(skyboxFolderPath, 'negy.jpg'));
            } else {
              // Create black images if black.jpg doesn't exist
              const blackImage = {
                create: {
                  width: size,
                  height: size,
                  channels: 3,
                  background: { r: 0, g: 0, b: 0 }
                }
              };
              
              await sharp(blackImage).jpeg().toFile(path.join(skyboxFolderPath, 'posz.jpg'));
              await sharp(blackImage).jpeg().toFile(path.join(skyboxFolderPath, 'negz.jpg'));
              await sharp(blackImage).jpeg().toFile(path.join(skyboxFolderPath, 'posy.jpg'));
              await sharp(blackImage).jpeg().toFile(path.join(skyboxFolderPath, 'negy.jpg'));
            }
            
            // Respond with the paths to the original image, depth map, and skybox
            res.json({
              originalImage: `/uploads/${folderName}/${req.file.filename}`,
              depthMap: `/uploads/${folderName}/depth/${folderName}-dpt_swin2_large_384.png`,
              skyboxPath: `/textures/cube/${skyboxFolderName}/`
            });
            
          } catch (imageError) {
            console.error('Error processing depth map for skybox:', imageError);
            // Still return the original paths even if skybox creation fails
            res.json({
              originalImage: `/uploads/${folderName}/${req.file.filename}`,
              depthMap: `/uploads/${folderName}/depth/${folderName}-dpt_swin2_large_384.png`
            });
          }

          // Respond with the paths to the original image and the depth map
          // return res.json({
          //   originalImage: `/uploads/${folderName}/${req.file.filename}`,
          //   depthMap: `/uploads/${folderName}/depth/${folderName}-dpt_swin2_large_384.png`,
          // });
        }

        // If no depth map was generated, return an error
        return res.status(500).json({ error: 'Error processing image with MiDaS.' });
      }

      console.log('MiDaS output:', stdout);

      // Check if the depth map was generated
      const depthMapFilePath = path.join(depthFolderPath, `${folderName}-dpt_swin2_large_384.png`);
      if (!fs.existsSync(depthMapFilePath)) {
        console.error('Depth map not found:', depthMapFilePath);
        return res.status(500).json({ error: 'Depth map generation failed.' });
      }

      // Respond with the paths to the original image and the depth map
      res.json({
        originalImage: `/uploads/${folderName}/${req.file.filename}`,
        depthMap: `/uploads/${folderName}/depth/${folderName}-dpt_swin2_large_384.png`,
      });
    });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});


// screenshot
const bodyParser = require('body-parser');
const ftp = require('basic-ftp');

// Middleware to parse JSON requests
app.use(bodyParser.json({ limit: '10mb' }));

// Endpoint to save the screenshot
app.post('/save-screenshot', async (req, res) => {
  const imageData = req.body.image;

  if (!imageData) {
    return res.status(400).send('No image data provided.');
  }

  // Decode the Base64 image data
  const base64Data = imageData.replace(/^data:image\/jpeg;base64,/, '');

  // Generate the timestamp in the same format as the upload function
  const now = new Date();
  const timestamp = now.toISOString().split('.')[0].replace(/:/g, '-');

  // Construct the screenshot filename
  const screenshotFilename = `${timestamp}-screenshot.jpg`;
  const screenshotPath = path.join(__dirname, 'public', 'screenshots', screenshotFilename);

  // Ensure the screenshots folder exists
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

  // Save the image locally
  fs.writeFile(screenshotPath, base64Data, 'base64', async (err) => {
    if (err) {
      console.error('Error saving screenshot:', err);
      return res.status(500).send('Failed to save screenshot.');
    }

    console.log('Screenshot saved locally to:', screenshotPath);

    // Upload the screenshot to the remote server via FTP
    const client = new ftp.Client();
    client.ftp.verbose = true;

    try {
      await client.access({
        host: '77.72.2.82', // Replace with your FTP host
        user: 'photofake@oc-d.co.uk', // Replace with your FTP username
        password: 'u#@6XWL0\*5!kt@1iv4RH', // Replace with your FTP password
        secure: true, // Enable FTPS
        secureOptions: {
          rejectUnauthorized: false, // Allow self-signed certificates if necessary
        },
      });

      console.log('Connected to FTP server.');

      // Upload the file
      await client.uploadFrom(screenshotPath, `/screenshots/${screenshotFilename}`); // Adjust the remote path as needed
      console.log('Screenshot uploaded to FTP server.');

      res.status(200).send({
        message: 'Screenshot saved locally and uploaded to the server.',
        filename: screenshotFilename,
        remoteUrl: `https://photofakery.compiler.zone/screenshots/${screenshotFilename}`, // Replace with your domain
      });
    } catch (ftpError) {
      console.error('Error uploading screenshot to FTP server:', ftpError);
      res.status(500).send('Failed to upload screenshot to the server.');
    } finally {
      client.close();
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});