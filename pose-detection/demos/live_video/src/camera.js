/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
import * as posedetection from '@tensorflow-models/pose-detection';
import * as scatter from 'scatter-gl';

import * as params from './params';
import {isMobile} from './util';

import {Particle} from './particle';
import { groupEnd } from 'console';

// These anchor points allow the pose pointcloud to resize according to its
// position in the input.
const ANCHOR_POINTS = [[0, 0, 0], [0, 1, 0], [-1, 0, 0], [-1, -1, 0]];

// #ffffff - White
// #800000 - Maroon
// #469990 - Malachite
// #e6194b - Crimson
// #42d4f4 - Picton Blue
// #fabed4 - Cupid
// #aaffc3 - Mint Green
// #9a6324 - Kumera
// #000075 - Navy Blue
// #f58231 - Jaffa
// #4363d8 - Royal Blue
// #ffd8b1 - Caramel
// #dcbeff - Mauve
// #808000 - Olive
// #ffe119 - Candlelight
// #911eb4 - Seance
// #bfef45 - Inchworm
// #f032e6 - Razzle Dazzle Rose
// #3cb44b - Chateau Green
// #a9a9a9 - Silver Chalice
const COLOR_PALETTE = [
  '#ffffff', '#800000', '#469990', '#e6194b', '#42d4f4', '#fabed4', '#aaffc3',
  '#9a6324', '#000075', '#f58231', '#4363d8', '#ffd8b1', '#dcbeff', '#808000',
  '#ffe119', '#911eb4', '#bfef45', '#f032e6', '#3cb44b', '#a9a9a9'
];
export class Camera {
  constructor() {
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('output');
    this.ctx = this.canvas.getContext('2d');
    this.scatterGLEl = document.querySelector('#scatter-gl-container');
    this.scatterGL = new scatter.ScatterGL(this.scatterGLEl, {
      'rotateOnStart': true,
      'selectEnabled': false,
      'styles': {polyline: {defaultOpacity: 1, deselectedOpacity: 1}}
    });
    this.scatterGLHasInitialized = false;

    this.maxPoses = 6;
    this.particleGroups = [];
    for (let i=0; i<this.maxPoses; i++) {
      const group = {
        id: null,
        updated: false,
        particles: Array.from({length: 14}, () => new Particle()),
      };
      this.particleGroups.push(group);
    }

    this.pseudoRand = Array.from({length: 100}, () => (Math.random() * 0.75) + 0.25);
    
    // this.setupAllPairs();
    
    // window.setInterval(() => {
    //   this.setupAllPairs();
    // }, 10 * 1000);

    window.document.onkeydown = (e) => {
      if (e.key === 'f') {
        this.canvas.requestFullscreen();
        document.body.style.cursor = 'none';
      }
      // if (e.key === ' ') {
      //   this.setupAllPairs();
      // }
    };
  }

  setupAllPairs() {
    this.numOpaque = params.STATE.render.numOpaque;
    this.numTranslucent = params.STATE.render.numTranslucent;
    const numParts = this.partsInUse.length;
    const allPairs = [];
    for (let i=0; i<numParts; i++) {
      for (let j=0; j<numParts; j++) {
        allPairs.push([i, j]);
      }
    }
    this.allPairs = this.shuffle(allPairs);
    this.opaquePairs = this.allPairs.slice(0, this.numOpaque);
    this.translucentPairs = this.allPairs.slice(this.numOpaque, this.numOpaque + this.numTranslucent);
    console.log(this.opaquePairs);
  }

  shuffle(array) {
    let currentIndex = array.length;
    let randomIndex;
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
    return array;
  }

  /**
   * Initiate a Camera instance and wait for the camera stream to be ready.
   * @param cameraParam From app `STATE.camera`.
   */
  static async setupCamera(cameraParam) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
          'Browser API navigator.mediaDevices.getUserMedia not available');
    }

    const {targetFPS, sizeOption} = cameraParam;
    const $size = params.VIDEO_SIZE[sizeOption];
    const videoConfig = {
      'audio': false,
      'video': {
        facingMode: 'user',
        // Only setting the video to a specified size for large screen, on
        // mobile devices accept the default size.
        width: isMobile() ? params.VIDEO_SIZE['360 X 270'].width : $size.width,
        height: isMobile() ? params.VIDEO_SIZE['360 X 270'].height :
                             $size.height,
        frameRate: {
          ideal: targetFPS,
        }
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(videoConfig);

    const camera = new Camera();
    camera.video.srcObject = stream;

    await new Promise((resolve) => {
      camera.video.onloadedmetadata = () => {
        resolve(video);
      };
    });

    camera.video.play();

    const videoWidth = camera.video.videoWidth;
    const videoHeight = camera.video.videoHeight;
    // Must set below two lines, otherwise video element doesn't show.
    camera.video.width = videoWidth;
    camera.video.height = videoHeight;

    camera.canvas.width = videoWidth;
    camera.canvas.height = videoHeight;
    const canvasContainer = document.querySelector('.canvas-wrapper');
    canvasContainer.style = `width: ${videoWidth}px; height: ${videoHeight}px`;

    // Because the image from camera is mirrored, need to flip horizontally.
    camera.ctx.translate(camera.video.videoWidth, 0);
    camera.ctx.scale(-1, 1);

    camera.scatterGLEl.style =
        `width: ${videoWidth}px; height: ${videoHeight}px;`;
    camera.scatterGL.resize();

    camera.scatterGLEl.style.display =
        params.STATE.modelConfig.render3D ? 'inline-block' : 'none';

    return camera;
  }

  drawCtx() {
    this.ctx.filter = 'grayscale(100%)';
    this.ctx.drawImage(
        this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);
    this.ctx.filter = 'none';
  }

  clearCtx() {
    this.ctx.clearRect(0, 0, this.video.videoWidth, this.video.videoHeight);
  }

  updateGroup(group, pose) {
      for (let i=0; i < pose.keypointsInUse.length; i++) {
        group.particles[i].update(pose.keypointsInUse[i]);
    }
    group.updated = true;
  }

  /**
   * Draw the keypoints and skeleton on the video.
   * @param poses A list of poses to render.
   */
  drawResults(poses) {
    const partsInUse = this.getPartsInUse();
    // update particle groups for existing ids, and set id for new groups if needed
    for (const pose of poses) {
      pose.keypointsInUse = pose.keypoints.filter((p) => partsInUse.includes(p.name));
      const matchingGroup = this.particleGroups.find((group) => group.id === pose.id);
      if (matchingGroup) {
        this.updateGroup(matchingGroup, pose);
      } else {
        const nullGroup = this.particleGroups.find((group) => group.id === null);
        if (nullGroup) {
          nullGroup.id = pose.id;
          this.updateGroup(nullGroup, pose);
        }
      }
    }

    // all particles in all groups do a postupdate
    for (const group of this.particleGroups) {
      for (const particle of group.particles) {
        particle.postUpdate(group.updated);
      }
    }

    // if a group has an id but has not been updated, clear its id
    for (const group of this.particleGroups) {
      if ((group.id !== null) && (group.updated === false)) {
        group.id = null;
      }
      group.updated = false;
    }

    // make a filtered list of particle groups that have ids set
    this.particleGroupsToDraw = this.particleGroups.filter(
      (group) => group.id !== null
    );

    // sort left to right
    this.particleGroupsToDraw.sort((first, second) => {
      return first.particles[0].x - second.particles[0].x;
    });

    // draw
    let count = 0;

    if (this.particleGroupsToDraw.length === 1) {
      for (const p1 of this.particleGroupsToDraw[0].particles) {
        for (const p2 of this.particleGroupsToDraw[0].particles) {
          let alpha = Math.min(p1.stableFrames, p2.stableFrames) / 100;
          alpha *= this.pseudoRand[count];
          if (alpha > 0) {
            count++;
            const hue = (count + Date.now() / 100) % 360;
            this.ctx.lineWidth = 4;
            this.ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.stroke();
          }
        }
      }
    }
    for (let i=0; i<this.particleGroupsToDraw.length - 1; i++) {
      for (const p1 of this.particleGroupsToDraw[i].particles) {
        for (const p2 of this.particleGroupsToDraw[i+1].particles) {
          let alpha = Math.min(p1.stableFrames, p2.stableFrames) / 100;
          alpha *= this.pseudoRand[count];
          if (alpha > 0) {
            count++;
            const hue = (i * 5 + count + Date.now() / 100) % 360;
            this.ctx.lineWidth = 4;
            this.ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.stroke();
          }
        }
      }
    }
  }

  getPartsInUse() {
    const partsInUse = [];
    if (params.STATE.render.nose) partsInUse.push('nose');
    if (params.STATE.render.left_ear) partsInUse.push('left_ear');
    if (params.STATE.render.right_ear) partsInUse.push('right_ear');
    if (params.STATE.render.left_shoulder) partsInUse.push('left_shoulder');
    if (params.STATE.render.right_shoulder) partsInUse.push('right_shoulder');
    if (params.STATE.render.left_elbow) partsInUse.push('left_elbow');
    if (params.STATE.render.right_elbow) partsInUse.push('right_elbow');
    if (params.STATE.render.left_wrist) partsInUse.push('left_wrist');
    if (params.STATE.render.right_wrist) partsInUse.push('right_wrist');
    if (params.STATE.render.left_hip) partsInUse.push('left_hip');
    if (params.STATE.render.right_hip) partsInUse.push('right_hip');
    if (params.STATE.render.left_knee) partsInUse.push('left_knee');
    if (params.STATE.render.right_knee) partsInUse.push('right_knee');
    if (params.STATE.render.left_ankle) partsInUse.push('left_ankle');
    if (params.STATE.render.right_ankle) partsInUse.push('right_ankle');
    return partsInUse;
  }

  drawAll(poses, pairList, opaque) {
    if (params.STATE.isPairsOptionChanged) {
      params.STATE.isPairsOptionChanged = false;
      this.setupAllPairs();
    }
    if (poses.length < 2) return;
    for (let i=0; i<poses.length-1; i++) {
      this.drawPair(poses[i], poses[i+1], pairList, opaque);
    }
  }

  drawPair(pose1, pose2, pairList, opaque) {
    let c = 0;
    for (const pair of pairList) {
      const p1 = pose1.partPoints[pair[0]];
      const p2 = pose2.partPoints[pair[1]];
      if (p1.score < params.STATE.modelConfig.scoreThreshold) continue;
      if (p2.score < params.STATE.modelConfig.scoreThreshold) continue;
      this.ctx.lineWidth = 4;
      c++;
      const frac = c / pairList.length;
      const hue = 0 + frac * 90;
      const alpha = opaque ? 0.9 : 0.25;
      this.ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
    } 
  }

  /**
   * Draw the keypoints and skeleton on the video.
   * @param pose A pose with keypoints to render.
   */
  drawResult(pose) {
    if (pose.keypoints != null) {
      this.drawKeypoints(pose.keypoints);
      this.drawSkeleton(pose.keypoints, pose.id);
    }
    if (pose.keypoints3D != null && params.STATE.modelConfig.render3D) {
      this.drawKeypoints3D(pose.keypoints3D);
    }    
  }

  /**
   * Draw the keypoints on the video.
   * @param keypoints A list of keypoints.
   */
  drawKeypoints(keypoints) {
    const keypointInd =
        posedetection.util.getKeypointIndexBySide(params.STATE.model);
    this.ctx.fillStyle = 'Red';
    this.ctx.strokeStyle = 'White';
    this.ctx.lineWidth = params.DEFAULT_LINE_WIDTH;

    for (const i of keypointInd.middle) {
      this.drawKeypoint(keypoints[i]);
    }

    this.ctx.fillStyle = 'Green';
    for (const i of keypointInd.left) {
      this.drawKeypoint(keypoints[i]);
    }

    this.ctx.fillStyle = 'Orange';
    for (const i of keypointInd.right) {
      this.drawKeypoint(keypoints[i]);
    }
  }

  drawKeypoint(keypoint) {
    // If score is null, just show the keypoint.
    const score = keypoint.score != null ? keypoint.score : 1;
    const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;

    if (score >= scoreThreshold) {
      const circle = new Path2D();
      circle.arc(keypoint.x, keypoint.y, params.DEFAULT_RADIUS, 0, 2 * Math.PI);
      this.ctx.fill(circle);
      this.ctx.stroke(circle);
    }
  }

  /**
   * Draw the skeleton of a body on the video.
   * @param keypoints A list of keypoints.
   */
  drawSkeleton(keypoints, poseId) {
    // Each poseId is mapped to a color in the color palette.
    const color = params.STATE.modelConfig.enableTracking && poseId != null ?
        COLOR_PALETTE[poseId % 20] :
        'White';
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = params.DEFAULT_LINE_WIDTH;

    posedetection.util.getAdjacentPairs(params.STATE.model).forEach(([
                                                                      i, j
                                                                    ]) => {
      const kp1 = keypoints[i];
      const kp2 = keypoints[j];

      // If score is null, just show the keypoint.
      const score1 = kp1.score != null ? kp1.score : 1;
      const score2 = kp2.score != null ? kp2.score : 1;
      const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;

      if (score1 >= scoreThreshold && score2 >= scoreThreshold) {
        this.ctx.beginPath();
        this.ctx.moveTo(kp1.x, kp1.y);
        this.ctx.lineTo(kp2.x, kp2.y);
        this.ctx.stroke();
      }
    });
  }

  drawKeypoints3D(keypoints) {
    const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;
    const pointsData =
        keypoints.map(keypoint => ([-keypoint.x, -keypoint.y, -keypoint.z]));

    const dataset =
        new scatter.ScatterGL.Dataset([...pointsData, ...ANCHOR_POINTS]);

    const keypointInd =
        posedetection.util.getKeypointIndexBySide(params.STATE.model);
    this.scatterGL.setPointColorer((i) => {
      if (keypoints[i] == null || keypoints[i].score < scoreThreshold) {
        // hide anchor points and low-confident points.
        return '#ffffff';
      }
      if (i === 0) {
        return '#ff0000' /* Red */;
      }
      if (keypointInd.left.indexOf(i) > -1) {
        return '#00ff00' /* Green */;
      }
      if (keypointInd.right.indexOf(i) > -1) {
        return '#ffa500' /* Orange */;
      }
    });

    if (!this.scatterGLHasInitialized) {
      this.scatterGL.render(dataset);
    } else {
      this.scatterGL.updateDataset(dataset);
    }
    const connections = posedetection.util.getAdjacentPairs(params.STATE.model);
    const sequences = connections.map(pair => ({indices: pair}));
    this.scatterGL.setSequences(sequences);
    this.scatterGLHasInitialized = true;
  }
}
