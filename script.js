// Find our HTML elements from the page
const videoElement = document.getElementById('video_player');
const videoUpload = document.getElementById('video_upload');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const feedbackElement = document.getElementById("feedback");

// --- State Variables for Tracking ---
let lockedOnPerson = null; // This will store the landmarks of the person we are tracking.
const LOCK_ON_DISTANCE_THRESHOLD = 200; // Max distance in pixels from center to lock on.
const TRACKING_CONTINUITY_THRESHOLD = 150; // Max distance in pixels a person can move between frames.
let detectionsInFrame = []; // Stores all detections from a single frame.

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

// This helper function calculates the distance between two points
function getDistance(point1, point2) {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// This helper function gets the center of the hips
function getCenter(landmarks) {
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  // We multiply by canvas dimensions to get pixel coordinates
  return {
    x: (leftHip.x + rightHip.x) / 2 * canvasElement.width,
    y: (leftHip.y + rightHip.y) / 2 * canvasElement.height,
  };
}

// This function is called every time the AI detects a person.
// We just add their landmarks to our list for this frame.
function onResults(results) {
  if (results.poseLandmarks) {
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
    // Draw the skeleton and run the coaching logic
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

// --- Setup the AI Model ---
const pose = new Pose({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
  }
});

pose.setOptions({
  modelComplexity: 2,
  smoothLandmarks: true,
  minDetectionConfidence: 0.75,
  minTrackingConfidence: 0.75
});

// Connect our main function (onResults) to the AI
pose.onResults(onResults);


// --- Logic for processing the video ---
async function processFrame() {
  // If the video is not paused and has not ended, send the frame to MediaPipe
  if (!videoElement.paused && !videoElement.ended) {
    // Clear the detections from the last frame
    detectionsInFrame = [];

    // Set the canvas to the video's current size
    canvasElement.width = videoElement.clientWidth;
    canvasElement.height = videoElement.clientHeight;

    // Send the video frame to the AI
    await pose.send({image: videoElement});

    // Draw the video frame onto the canvas
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

    // Process the detections we received
    processDetections();

    // Rerun the processFrame function on the next frame
    requestAnimationFrame(processFrame);
  }
}

// When the video starts playing, or resumes from a pause, begin processing frames.
videoElement.addEventListener('play', () => {
  requestAnimationFrame(processFrame);
});
videoElement.addEventListener('playing', () => {
  requestAnimationFrame(processFrame);
});
