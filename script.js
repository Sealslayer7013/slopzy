// Find our HTML elements from the page
const videoElement = document.getElementById('video_player');
const videoUpload = document.getElementById('video_upload');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const feedbackElement = document.getElementById("feedback");

// --- State Variables for Tracking ---
let lockedOnPerson = null; // This will store the landmarks of the person we are tracking.
const LOCK_ON_DISTANCE_THRESHOLD = 400; // Max distance in pixels from center to lock on.
const TRACKING_CONTINUITY_THRESHOLD = 300; // Max distance in pixels a person can move between frames.
let detectionsInFrame = []; // Stores all detections from a single frame.

// --- Logic for loading the video file ---
videoUpload.addEventListener('change', (e) => {
  // When a new file is uploaded, reset the tracking
  lockedOnPerson = null;
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    videoElement.src = url;
    videoElement.load();
    videoElement.play();
  }
});

// --- Helper Functions ---
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

function getDistance(point1, point2) {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCenter(landmarks) {
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  return {
    x: (leftHip.x + rightHip.x) / 2 * canvasElement.width,
    y: (leftHip.y + rightHip.y) / 2 * canvasElement.height,
  };
}

// --- MediaPipe and Processing Functions ---

// This function is called every time the AI has results.
// We just add any found landmarks to our list for this frame.
function onResults(results) {
  if (results.multiPoseLandmarks) {
    detectionsInFrame.push(...results.multiPoseLandmarks);
  } else if (results.poseLandmarks) {
    // Fallback for single pose detection
    detectionsInFrame.push(results.poseLandmarks);
  }
}

// This function processes the batch of detections for a single frame
function processDetections() {
  // Find the best candidate from the detections in the frame
  let bestCandidate = null;
  if (lockedOnPerson === null) {
    // If we are not tracking anyone, find the person closest to the center
    let minDistance = LOCK_ON_DISTANCE_THRESHOLD;
    const screenCenter = { x: canvasElement.width / 2, y: canvasElement.height / 2 };
    for (const landmarks of detectionsInFrame) {
      const personCenter = getCenter(landmarks);
      const distance = getDistance(personCenter, screenCenter);
      if (distance < minDistance) {
        minDistance = distance;
        bestCandidate = landmarks;
      }
    }
  } else {
    // If we are already tracking someone, find the person closest to the last known position
    let minDistance = TRACKING_CONTINUITY_THRESHOLD;
    const lockedOnCenter = getCenter(lockedOnPerson);
    for (const landmarks of detectionsInFrame) {
      const personCenter = getCenter(landmarks);
      const distance = getDistance(personCenter, lockedOnCenter);
      if (distance < minDistance) {
        minDistance = distance;
        bestCandidate = landmarks;
      }
    }
  }
  lockedOnPerson = bestCandidate;

  // --- This section only runs if we have a locked-on person ---
  if (lockedOnPerson) {
    drawConnectors(canvasCtx, lockedOnPerson, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
    drawLandmarks(canvasCtx, lockedOnPerson, {color: '#FF0000', radius: 2});

    const leftHip = lockedOnPerson[23];
    const leftKnee = lockedOnPerson[25];
    const leftAnkle = lockedOnPerson[27];
    const kneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);

    let feedbackText = "";
    if (kneeAngle > 160) {
      feedbackText = "Bend your knees!";
    } else {
      feedbackText = "Good stance!";
    }

    feedbackElement.innerHTML = feedbackText + "<br>Knee Angle: " + Math.round(kneeAngle);
  } else {
    feedbackElement.innerHTML = "Looking for skier...";
  }
}

// --- MediaPipe Setup ---
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 2,
  smoothLandmarks: true,
  minDetectionConfidence: 0.75,
  minTrackingConfidence: 0.75,
});

pose.onResults(onResults);

// --- Main Video Processing Loop ---
async function processFrame() {
  // Clear the detections from the last frame before we start a new one
  detectionsInFrame = [];

  // Send the current video frame to MediaPipe for analysis
  await pose.send({image: videoElement});

  // Now that pose.send is complete, onResults has been called and
  // our detectionsInFrame array is populated. We can now process it.

  // Set the canvas to the video's current size
  canvasElement.width = videoElement.clientWidth;
  canvasElement.height = videoElement.clientHeight;

  // Draw the video frame onto the canvas
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

  // Process the batch of detections we received for this frame
  processDetections();

  // If the video is still playing, request the next frame
  if (!videoElement.paused && !videoElement.ended) {
    requestAnimationFrame(processFrame);
  }
}

videoElement.addEventListener('play', () => requestAnimationFrame(processFrame));
videoElement.addEventListener('playing', () => requestAnimationFrame(processFrame));
