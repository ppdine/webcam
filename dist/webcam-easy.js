
class Webcam {
  constructor(webcamElement, facingMode = 'user', canvasElement = null, snapSoundElement = null) {
    this._webcamElement = webcamElement;
    this._webcamElement.width = this._webcamElement.width || 640;
    this._webcamElement.height = this._webcamElement.height || 360;
    this._facingMode = facingMode;
    this._webcamList = [];
    this._streamList = [];
    this._selectedDeviceId = '';
    this._canvasElement = canvasElement;
    this._snapSoundElement = snapSoundElement;
    this._captureInterval = null; // Store the interval ID for automatic capture
  }

  get facingMode() {
    return this._facingMode;
  }

  set facingMode(value) {
    this._facingMode = value;
  }

  get webcamList() {
    return this._webcamList;
  }

  get webcamCount() {
    return this._webcamList.length;
  }

  get selectedDeviceId() {
    return this._selectedDeviceId;
  }

  getVideoInputs(mediaDevices) {
    this._webcamList = [];
    mediaDevices.forEach(mediaDevice => {
      if (mediaDevice.kind === 'videoinput') {
        this._webcamList.push(mediaDevice);
      }
    });
    if (this._webcamList.length == 1) {
      this._facingMode = 'user';
    }
    return this._webcamList;
  }

  getMediaConstraints() {
    var videoConstraints = {};
    if (this._selectedDeviceId == '') {
      videoConstraints.facingMode = this._facingMode;
    } else {
      videoConstraints.deviceId = { exact: this._selectedDeviceId };
    }
    videoConstraints.width = { exact: this._webcamElement.width };
    videoConstraints.height = { exact: this._webcamElement.height };
    var constraints = {
      video: videoConstraints,
      audio: false
    };
    return constraints;
  }

  selectCamera() {
    for (let webcam of this._webcamList) {
      if ((this._facingMode == 'user' && webcam.label.toLowerCase().includes('front'))
        || (this._facingMode == 'enviroment' && webcam.label.toLowerCase().includes('back'))
      ) {
        this._selectedDeviceId = webcam.deviceId;
        break;
      }
    }
  }

  flip() {
    this._facingMode = (this._facingMode == 'user') ? 'enviroment' : 'user';
    this._webcamElement.style.transform = "";
    this.selectCamera();
  }

  async start(startStream = true) {
    return new Promise((resolve, reject) => {
      this.stop();
      navigator.mediaDevices.getUserMedia(this.getMediaConstraints())
        .then(stream => {
          this._streamList.push(stream);
          this.info()
            .then(webcams => {
              this.selectCamera();
              if (startStream) {
                this.stream()
                  .then(facingMode => {
                    resolve(this._facingMode);
                  })
                  .catch(error => {
                    reject(error);
                  });
              } else {
                resolve(this._selectedDeviceId);
              }
            })
            .catch(error => {
              reject(error);
            });
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  async info() {
    return new Promise((resolve, reject) => {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          this.getVideoInputs(devices);
          resolve(this._webcamList);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  async stream() {
    return new Promise((resolve, reject) => {
      navigator.mediaDevices.getUserMedia(this.getMediaConstraints())
        .then(stream => {
          this._streamList.push(stream);
          this._webcamElement.srcObject = stream;
          if (this._facingMode == 'user') {
            this._webcamElement.style.transform = "scale(-1,1)";
          }
          this._webcamElement.play();
          resolve(this._facingMode);
        })
        .catch(error => {
          console.log(error);
          reject(error);
        });
    });
  }

  stop() {
    this._streamList.forEach(stream => {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    });
  }

  snap() {
    if (this._canvasElement != null) {
      if (this._snapSoundElement != null) {
        this._snapSoundElement.play();
      }
      this._canvasElement.height = this._webcamElement.scrollHeight;
      this._canvasElement.width = this._webcamElement.scrollWidth;
      let context = this._canvasElement.getContext('2d');
      if (this._facingMode == 'user') {
        context.translate(this._canvasElement.width, 0);
        context.scale(-1, 1);
      }
      context.clearRect(0, 0, this._canvasElement.width, this._canvasElement.height);
      context.drawImage(this._webcamElement, 0, 0, this._canvasElement.width, this._canvasElement.height);
      let data = this._canvasElement.toDataURL('image/png');
      return data;
    } else {
      throw "canvas element is missing";
    }
  }

  // Method to start automatic capture
  startAutoCapture(interval = 5000) {
    this.stopAutoCapture(); // Ensure no other interval is running
    this._captureInterval = setInterval(() => {
      try {
        this.snap();
      } catch (error) {
        console.error("Error capturing image: ", error);
      }
    }, interval);
  }

  // Method to stop automatic capture
  stopAutoCapture() {
    if (this._captureInterval) {
      clearInterval(this._captureInterval);
      this._captureInterval = null;
    }
  }
}

// Phần sử dụng lớp Webcam
const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const snapSoundElement = document.getElementById('snapSound');
const webcam = new Webcam(webcamElement, 'user', canvasElement, snapSoundElement);

let hideElement = true;

$("#webcam-switch").change(function () {
  if (this.checked) {
    $('.md-modal').addClass('md-show');
    webcam.start()
      .then(result => {
        cameraStarted();
        webcam.startAutoCapture(3000); // Bắt đầu chụp tự động mỗi 3 giây
        console.log("webcam started", result);
      })
      .catch(err => {
        displayError(err);
      });
  } else {
    cameraStopped();
    webcam.stopAutoCapture(); // Dừng chụp tự động
    webcam.stop(); // Dừng webcam
    console.log("webcam stopped");
  }
});

$('#cameraFlip').click(function () {
  webcam.flip();
  webcam.start();
});

$('#closeError').click(function () {
  $("#webcam-switch").prop('checked', false).change();
});

$("#take-photo").click(function () {
  beforeTakePhoto();
  let picture = webcam.snap();
  console.log("#take-photo", picture);

  document.querySelector('#download-photo').href = picture;
  afterTakePhoto();
});

$("#resume-camera").click(function () {
  webcam.stream()
    .then(facingMode => {
      removeCapture();
    });
});

$("#exit-app").click(function () {
  removeCapture();
  $("#webcam-switch").prop("checked", false).change();
});

function displayError(err = '') {
  if (err != '') {
    $("#errorMsg").html(err);
  }
  $("#errorMsg").removeClass("d-none");
}

function cameraStarted() {
  $("#errorMsg").addClass("d-none");
  $('.flash').hide();
  $("#webcam-caption").html("on");
  $("#webcam-control").removeClass("webcam-off");
  $("#webcam-control").addClass("webcam-on");
  $(".webcam-container").removeClass("d-none");
  if (hideElement == true) {
    hideElements();
  }
}

function cameraStopped() {
  $("#errorMsg").addClass("d-none");
  $("#webcam-control").removeClass("webcam-on");
  $("#webcam-control").addClass("webcam-off");
  $(".webcam-container").addClass("d-none");
  $("#webcam-caption").html("Click to Start Camera");
}

function hideElements() {
  $(".controls").addClass('d-none');
  $(".cheese").addClass('d-none');
  $("#hideControls").removeClass('d-none');
}

function beforeTakePhoto() {
  $('.flash')
    .show()
    .animate({ opacity: 0.3 }, 500)
    .fadeOut(500)
    .css({ 'opacity': 0.7 });
  window.scrollTo(0, 0);
  $("#webcam-caption").html("on");
  $("#webcam-control").removeClass("webcam-off");
  $("#webcam-control").addClass("webcam-on");
  $(".webcam-container").removeClass("d-none");
}

function afterTakePhoto() {
  webcam.stop();
  $("#canvas").removeClass('d-none');
  $("#webcam-control").removeClass("webcam-on");
  $("#webcam-control").addClass("webcam-off");
  $("#webcam-caption").html("Click to Start Camera");
  $("#webcam-switch").prop('checked', false);
  $("#take-photo").addClass('d-none');
  $("#exit-app").removeClass('d-none');
  $("#resume-camera").removeClass('d-none');
  $("#download-photo").removeClass('d-none');
}

function removeCapture() {
  $("#canvas").addClass('d-none');
  $("#webcam-control").removeClass("webcam-off");
  $("#webcam-control").addClass("webcam-on");
  $("#webcam-caption").html("on");
  $("#webcam-switch").prop('checked', true);
  $("#take-photo").removeClass('d-none');
  $("#exit-app").addClass('d-none');
  $("#resume-camera").addClass('d-none');
  $("#download-photo").addClass('d-none');
}