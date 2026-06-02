// File upload trigger for number counter

// Simple file upload trigger monitor for NUMBER input (not checkbox)
(function() {
    console.log("[MCP File Upload] Setting up monitor for number input...");
    
    let lastFileUploadCount = 0;
    let monitorSetup = false;
    
    const setupMonitor = () => {
        if (monitorSetup) return;
        
        // Look for the NUMBER input (not checkbox!)
        const numberInput = document.querySelector("#file-upload-trigger input[type='number']");
        
        if (numberInput) {
            console.log("[MCP File Upload] Found number input!");
            monitorSetup = true;
            
            // Poll for value changes
            setInterval(() => {
                const currentValue = parseInt(numberInput.value) || 0;
                
                if (currentValue > lastFileUploadCount) {
                    console.log(`[MCP File Upload] Counter increased: ${lastFileUploadCount} -> ${currentValue}`);
                    
                    // Find and click the file upload button
                    const uploadDiv = document.querySelector(".file-upload-dropzone");
                    if (uploadDiv) {
                        const button = uploadDiv.querySelector("button");
                        if (button) {
                            console.log("[MCP File Upload] Clicking file upload button...");
                            button.click();
                        }
                    }
                    
                    lastFileUploadCount = currentValue;
                }
            }, 500);
            
        } else {
            // Keep trying to find the number input
            setTimeout(setupMonitor, 1000);
        }
    };
    
    // Start monitoring
    setupMonitor();
})();
