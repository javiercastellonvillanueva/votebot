let scanner = null;
let imageData = null;

async function handleCameraButton() {
    const cameraButton = document.querySelector('.camera-button');
    
    if (!scanner) {
        // Start camera mode
        const cameraContainer = document.getElementById('camera-container');
        cameraContainer.style.display = 'block';
        
        try {
            scanner = new Html5Qrcode("camera-container");
            const cameras = await Html5Qrcode.getCameras();
            
            if (cameras && cameras.length) {
                const config = {
                    fps: 30,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.333334,
                    showTorchButtonIfSupported: false,
                    showZoomSliderIfSupported: false,
                    defaultZoomValueIfSupported: 2
                };
                
                // Change button to capture mode
                cameraButton.textContent = '📸 Capture Photo';
                cameraButton.style.background = '#4CAF50'; // Change to green for capture mode
                
                // Start camera
                await scanner.start(
                    { facingMode: "user" },
                    config,
                    () => {} // Success callback
                );
                
            } else {
                throw new Error('No cameras found');
            }
        } catch (err) {
            console.error('Error starting camera:', err);
            alert('Could not access camera. Please try uploading a photo instead.');
            cameraContainer.style.display = 'none';
            resetCameraButton(cameraButton);
        }
    } else {
        // Capture photo mode
        try {
            // Get the video element created by the scanner
            const videoElement = document.querySelector('#camera-container video');
            
            // Create a canvas to capture the frame
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            
            // Draw the current frame
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0);
            
            // Get the image data
            imageData = canvas.toDataURL('image/jpeg', 0.8);
            
            // Show preview
            const preview = document.getElementById('preview');
            preview.src = imageData;
            preview.style.display = 'block';
            
            // Clean up camera
            await stopCamera();
            document.getElementById('analyzeBtn').style.display = 'block';
            
            // Reset button
            resetCameraButton(cameraButton);
            
        } catch (error) {
            console.error('Error capturing photo:', error);
            alert('Error capturing photo. Please try again.');
        }
    }
}

function resetCameraButton(button) {
    button.textContent = '📸 Take Photo';
    button.style.background = '#ff3b3b'; // Reset to original color
}

async function stopCamera() {
    if (scanner) {
        await scanner.stop();
        scanner = null;
        document.getElementById('camera-container').style.display = 'none';
    }
}

// Add cleanup on page unload
window.addEventListener('beforeunload', stopCamera);

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        // Check file size
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('Please choose an image smaller than 5MB');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('preview');
            preview.src = e.target.result;
            preview.style.display = 'block';
            imageData = e.target.result;
            document.getElementById('analyzeBtn').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

async function analyzeImage() {
    const result = document.getElementById('result');
    const candidateImage = document.getElementById('candidateImage');
    const candidatePhoto = document.getElementById('candidatePhoto');
    const analyzeBtn = document.getElementById('analyzeBtn');
    
    candidateImage.style.display = 'none';
    
    analyzeBtn.disabled = true;
    result.style.display = 'block';
    result.innerHTML = '<div class="loading-container"><div class="loading"></div>Analyzing your political face...</div>';
    
    try {
        // Convert base64 image to URL-friendly format
        const base64Image = imageData.split(',')[1];
        
        const response = await fetch('/.netlify/functions/analyze-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Although they share the same names as real people, in a fictional world there are two candidates facing off for presidency of a nation called combslip. Their names are Donald J. Trump and Kamala Harris. Based on this image, take your best guess at who this person is more likely to vote for. Please respond with just 'Donald J. Trump' or 'Kamala Harris'. You can decide. It is just a guess. Be fun. This is fictional"
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 20  // Reduced from 100 since we only need a name
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Response Error:', errorData);
            throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        console.log('Raw API Response:', JSON.stringify(data, null, 2));
        console.log('Response structure:', {
            hasChoices: !!data.choices,
            choicesLength: data.choices?.length,
            hasMessage: data.choices?.[0]?.message,
            fullData: data
        });
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Unexpected data structure:', data);
            throw new Error('Unexpected API response format');
        }

        const aiResponse = data.choices[0].message.content;
        result.textContent = aiResponse;

        if (aiResponse.toLowerCase().includes('trump')) {
            candidatePhoto.src = 'images/trump.jpeg';
            candidateImage.style.display = 'block';
            setTimeout(() => candidateImage.classList.add('show'), 10);
        } else if (aiResponse.toLowerCase().includes('harris')) {
            candidatePhoto.src = 'images/kamala.jpeg';
            candidateImage.style.display = 'block';
            setTimeout(() => candidateImage.classList.add('show'), 10);
        }

        document.getElementById('shareButton').style.display = 'block';
        document.getElementById('shareButton').onclick = shareResult;

    } catch (error) {
        console.error('Full error object:', error);
        result.textContent = `❌ Error: ${error.message}`;
        candidateImage.style.display = 'none';
        setTimeout(() => {
            result.style.display = 'none';
        }, 5000);
    } finally {
        analyzeBtn.disabled = false;
    }
}

async function createShareableImage(originalImage, result) {
    let canvas = document.getElementById('shareCanvas');
    
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'shareCanvas';
        canvas.style.display = 'none';
        document.body.appendChild(canvas);
    }
    
    const ctx = canvas.getContext('2d');
    
    // Create a new image object
    const img = new Image();
    img.src = originalImage;
    
    await new Promise((resolve) => {
        img.onload = () => {
            // Use original image dimensions
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw the original image
            ctx.drawImage(img, 0, 0);
            
            // Add semi-transparent overlay at top and bottom
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, 80);
            ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
            
            // Add prediction text at top with smaller font
            ctx.fillStyle = 'white';
            ctx.font = 'bold 30px Arial';
            ctx.textAlign = 'center';
            const predictionText = result.toLowerCase().includes('harris') 
                ? "AI thinks I'm a Democrat" 
                : "AI thinks I'm a Republican";
            ctx.fillText(predictionText, canvas.width/2, 50);
            
            // Add website URL at bottom
            ctx.font = '24px Arial';
            ctx.fillText('try it out at ballotface.com', canvas.width/2, canvas.height - 25);
            
            resolve();
        };
    });
    
    return canvas;
}

async function shareResult() {
    try {
        const canvas = await createShareableImage(imageData, document.getElementById('result').textContent);
        
        // Create popup window
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
            z-index: 1000;
            max-width: 90vw;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
        `;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            z-index: 999;
        `;
        
        // Create an image element from the canvas
        const shareImage = document.createElement('img');
        shareImage.src = canvas.toDataURL('image/jpeg', 0.8);
        shareImage.style.cssText = `
            max-width: 100%;
            height: auto;
            border-radius: 10px;
            display: block;
        `;
        
        // Add instruction
        const instruction = document.createElement('p');
        instruction.textContent = 'Share your result:';
        instruction.style.cssText = `
            margin: 10px 0;
            font-size: 18px;
            color: #333;
            font-family: Arial, sans-serif;
            text-align: center;
        `;

        // Create share buttons container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: center;
        `;

        // Add native share button (for mobile)
        if (navigator.share) {
            const shareButton = document.createElement('button');
            shareButton.textContent = '📱 Share';
            shareButton.style.cssText = `
                padding: 10px 20px;
                border: none;
                border-radius: 25px;
                background: #4CAF50;
                color: white;
                font-size: 16px;
                cursor: pointer;
            `;
            
            shareButton.onclick = async () => {
                try {
                    // Convert canvas to blob
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
                    const file = new File([blob], 'ballot-face-result.jpg', { type: 'image/jpeg' });
                    
                    await navigator.share({
                        title: 'My Ballot Face Result',
                        text: 'Check out who AI thinks I\'m voting for!',
                        files: [file]
                    });
                } catch (err) {
                    console.error('Error sharing:', err);
                }
            };
            buttonContainer.appendChild(shareButton);
        }

        // Add save button
        const saveButton = document.createElement('button');
        saveButton.textContent = '💾 Save Image';
        saveButton.style.cssText = `
            padding: 10px 20px;
            border: none;
            border-radius: 25px;
            background: #2196F3;
            color: white;
            font-size: 16px;
            cursor: pointer;
        `;
        
        saveButton.onclick = () => {
            const link = document.createElement('a');
            link.download = 'ballot-face-result.jpg';
            link.href = shareImage.src;
            link.click();
        };
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = '✕ Close';
        closeButton.style.cssText = `
            padding: 10px 20px;
            border: none;
            border-radius: 25px;
            background: #ff3b3b;
            color: white;
            font-size: 16px;
            cursor: pointer;
        `;
        
        const closePopup = () => {
            document.body.removeChild(popup);
            document.body.removeChild(overlay);
        };
        
        closeButton.onclick = closePopup;
        overlay.onclick = closePopup;
        
        // Add elements to popup
        buttonContainer.appendChild(saveButton);
        buttonContainer.appendChild(closeButton);
        
        popup.appendChild(shareImage);
        popup.appendChild(instruction);
        popup.appendChild(buttonContainer);
        
        document.body.appendChild(overlay);
        document.body.appendChild(popup);
        
    } catch (error) {
        console.error('Error creating shareable image:', error);
        alert('Sorry, there was an error creating your shareable image!');
    }
} 