// Find our HTML elements from the page
const videoElement = document.getElementById('video_player');
const videoUpload = document.getElementById('video_upload');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const feedbackElement = document.getElementById("feedback");

// --- Logic for loading the video file ---
videoUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    videoElement.src = url;
    videoElement.load();
    videoElement.play(); // Autoplay the video once loaded
  }
});

// This is our helper function to calculate an angle between three dots
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);

  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

// This main function runs every time the AI sees a person
function onResults(results) {
  // Make the drawing canvas the same size as the video element on the screen
  canvasElement.width = videoElement.clientWidth;
  canvasElement.height = videoElement.clientHeight;

  // Clear the canvas and draw the video frame onto it
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  // If the AI finds pose dots, start the analysis
  if (results.poseLandmarks) {
    // Draw the skeleton lines and dots on the screen
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
    drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', radius: 2});

    // --- Start of Ski Coach Logic ---

    // Get the specific dots we need for the left leg
    const leftHip = results.poseLandmarks[23];
    const leftKnee = results.poseLandmarks[25];
    const leftAnkle = results.poseLandmarks[27];

    // Calculate the angle of the left knee using our function
    const kneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);

    // --- Start of Coaching Logic ---

    let feedbackText = "";
    // Check if the knee is too straight (e.g., > 160 degrees)
    if (kneeAngle > 160) {
      feedbackText = "Bend your knees!";
    } else {
      feedbackText = "Good stance!";
    }

    // Display the feedback and the angle on the screen
    feedbackElement.innerHTML = feedbackText + "<br>Knee Angle: " + Math.round(kneeAngle);

    // --- End of Ski Coach Logic ---
  }
}

// --- Setup the AI Model ---
const pose = new Pose({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
  }
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// Connect our main function (onResults) to the AI
pose.onResults(onResults);


// --- Logic for processing the video ---
async function processFrame() {
  // If the video is not paused and has not ended, send the frame to MediaPipe
  if (!videoElement.paused && !videoElement.ended) {
    await pose.send({image: videoElement});
    // Rerun the processFrame function on the next frame
    requestAnimationFrame(processFrame);
  }
}

// When the video starts playing, begin processing the frames
videoElement.addEventListener('play', () => {
  requestAnimationFrame(processFrame);
});
