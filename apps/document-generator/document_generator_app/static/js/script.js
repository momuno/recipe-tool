// Document Builder JavaScript
console.log('🚀 JavaScript file loaded successfully!');

// Drag and Drop Debug Logger
const DragDropLogger = {
    enabled: true,
    logHistory: [],
    maxHistorySize: 500,
    
    log: function(level, category, message, data = {}) {
        if (!this.enabled) return;
        
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            category,
            message,
            data,
            stack: new Error().stack
        };
        
        // Add to history
        this.logHistory.push(logEntry);
        if (this.logHistory.length > this.maxHistorySize) {
            this.logHistory.shift();
        }
        
        // Console output with styling
        const colors = {
            'ERROR': 'color: red; font-weight: bold',
            'WARN': 'color: orange; font-weight: bold',
            'INFO': 'color: blue',
            'DEBUG': 'color: gray',
            'SUCCESS': 'color: green; font-weight: bold'
        };
        
        console.log(
            `%c[${level}] [${category}] ${timestamp.split('T')[1]}`,
            colors[level] || 'color: black',
            message,
            data
        );
    },
    
    error: function(category, message, data) {
        this.log('ERROR', category, message, data);
    },
    
    warn: function(category, message, data) {
        this.log('WARN', category, message, data);
    },
    
    info: function(category, message, data) {
        this.log('INFO', category, message, data);
    },
    
    debug: function(category, message, data) {
        this.log('DEBUG', category, message, data);
    },
    
    success: function(category, message, data) {
        this.log('SUCCESS', category, message, data);
    },
    
    getDragDropState: function() {
        const state = {
            timestamp: new Date().toISOString(),
            resourceItems: [],
            dropZones: [],
            draggedResource: window.draggedResource,
            currentDraggedResource: window.currentDraggedResource
        };
        
        // Analyze resource items
        const resourceItems = document.querySelectorAll('.resource-item-gradio');
        resourceItems.forEach((item, index) => {
            state.resourceItems.push({
                index,
                draggable: item.getAttribute('draggable'),
                hasListeners: !!item._dragStartHandler || !!item._dragEndHandler,
                hasDragStart: !!item._dragStartHandler,
                hasDragEnd: !!item._dragEndHandler,
                classList: Array.from(item.classList),
                path: item.dataset.resourcePath,
                visible: item.offsetParent !== null,
                dimensions: {
                    width: item.offsetWidth,
                    height: item.offsetHeight
                }
            });
        });
        
        // Analyze drop zones
        const dropZones = document.querySelectorAll('.block-resources');
        dropZones.forEach((zone, index) => {
            const blockElement = zone.closest('.content-block');
            state.dropZones.push({
                index,
                hasListeners: !!zone._dragEnterHandler || !!zone._dropHandler,
                hasDragEnter: !!zone._dragEnterHandler,
                hasDragOver: !!zone._dragOverHandler,
                hasDrop: !!zone._dropHandler,
                hasDragLeave: !!zone._dragLeaveHandler,
                classList: Array.from(zone.classList),
                visible: zone.offsetParent !== null,
                parentBlockId: blockElement?.id,
                parentBlockDataId: blockElement?.dataset?.id,
                parentBlockExists: !!blockElement
            });
        });
        
        return state;
    },
    
    dumpState: function() {
        const state = this.getDragDropState();
        console.group('🔍 Current Drag-Drop State');
        console.log('Resource Items:', state.resourceItems);
        console.log('Drop Zones:', state.dropZones);
        console.log('Current Dragged Resource:', state.draggedResource);
        console.log('Window Dragged Resource:', state.currentDraggedResource);
        console.groupEnd();
        return state;
    },
    
    exportLogs: function() {
        const blob = new Blob([JSON.stringify(this.logHistory, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dragdrop-logs-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Make logger globally available for debugging
window.DragDropLogger = DragDropLogger;

// Drag-Drop Monitoring System
function startDragDropMonitoring() {
    DragDropLogger.info('MONITOR', 'Starting drag-drop monitoring system');
    
    // Track block interactions
    let blockInteractionDetected = false;
    let lastBlockRenderTime = 0;
    let lastResourceCount = 0;
    let resourceCountCheckInterval = null;
    
    // Monitor for DOM changes that might affect drag-drop
    const monitorObserver = new MutationObserver((mutations) => {
        let resourceItemsChanged = false;
        let dropZonesChanged = false;
        let blocksChanged = false;
        
        mutations.forEach((mutation) => {
            // Check if resource items were added/removed
            if (mutation.type === 'childList') {
                const addedResources = Array.from(mutation.addedNodes).filter(node => 
                    node.nodeType === 1 && node.classList?.contains('resource-item-gradio')
                );
                const removedResources = Array.from(mutation.removedNodes).filter(node => 
                    node.nodeType === 1 && node.classList?.contains('resource-item-gradio')
                );
                
                if (addedResources.length > 0) {
                    resourceItemsChanged = true;
                    DragDropLogger.warn('MONITOR', `${addedResources.length} resource items added to DOM`);
                    
                    // Force immediate setup for new resources
                    setTimeout(() => {
                        DragDropLogger.info('MONITOR', 'New resources detected - forcing immediate setup');
                        setupDragAndDrop();
                    }, 50);
                }
                if (removedResources.length > 0) {
                    resourceItemsChanged = true;
                    DragDropLogger.warn('MONITOR', `${removedResources.length} resource items removed from DOM`);
                }
                
                // Check for content block changes (indicates interaction)
                const addedBlocks = Array.from(mutation.addedNodes).filter(node => 
                    node.nodeType === 1 && (node.classList?.contains('content-block') || 
                    node.querySelector?.('.content-block'))
                );
                const removedBlocks = Array.from(mutation.removedNodes).filter(node => 
                    node.nodeType === 1 && (node.classList?.contains('content-block') ||
                    node.querySelector?.('.content-block'))
                );
                
                if (addedBlocks.length > 0 || removedBlocks.length > 0) {
                    blocksChanged = true;
                    blockInteractionDetected = true;
                    lastBlockRenderTime = Date.now();
                    DragDropLogger.warn('MONITOR', 'Content blocks changed - likely due to interaction', {
                        added: addedBlocks.length,
                        removed: removedBlocks.length
                    });
                }
                
                // Check for drop zones changes
                const addedDropZones = Array.from(mutation.addedNodes).filter(node => 
                    node.nodeType === 1 && (node.classList?.contains('block-resources') || 
                    node.querySelector?.('.block-resources'))
                );
                const removedDropZones = Array.from(mutation.removedNodes).filter(node => 
                    node.nodeType === 1 && (node.classList?.contains('block-resources') ||
                    node.querySelector?.('.block-resources'))
                );
                
                if (addedDropZones.length > 0 || removedDropZones.length > 0) {
                    dropZonesChanged = true;
                    DragDropLogger.warn('MONITOR', 'Drop zones changed in DOM');
                }
            }
            
            // Check if draggable attribute was changed
            if (mutation.type === 'attributes' && mutation.attributeName === 'draggable') {
                const element = mutation.target;
                if (element.classList?.contains('resource-item-gradio')) {
                    const currentValue = element.getAttribute('draggable');
                    DragDropLogger.error('MONITOR', 'Draggable attribute changed!', {
                        element,
                        newValue: currentValue,
                        oldValue: mutation.oldValue
                    });
                    
                    // Auto-fix if draggable was removed
                    if (currentValue !== 'true') {
                        element.setAttribute('draggable', 'true');
                        DragDropLogger.warn('MONITOR', 'Auto-fixed draggable attribute');
                    }
                }
            }
            
            // CRITICAL: Watch for class changes that indicate collapse/expand
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const element = mutation.target;
                if (element.classList?.contains('content-block') || 
                    element.classList?.contains('block-content') ||
                    element.classList?.contains('collapsed')) {
                    
                    DragDropLogger.warn('MONITOR', 'Block class change detected - likely collapse/expand!', {
                        element: element.tagName,
                        classes: Array.from(element.classList)
                    });
                    
                    // Schedule aggressive drop zone repair
                    setTimeout(() => {
                        const zones = document.querySelectorAll('.block-resources');
                        DragDropLogger.info('MONITOR', `Emergency repair of ${zones.length} drop zones after collapse toggle`);
                        setupDropZones(zones);
                        
                        // Also check resource items
                        const resources = document.querySelectorAll('.resource-item-gradio');
                        resources.forEach((item, idx) => {
                            if (!item._dragStartHandler || item.getAttribute('draggable') !== 'true') {
                                DragDropLogger.warn('MONITOR', `Resource ${idx} lost handlers, repairing`);
                            }
                        });
                        
                        // Full setup to be sure
                        setTimeout(setupDragAndDrop, 200);
                    }, 150);
                }
            }
        });
        
        // Re-setup drag and drop if significant changes detected
        if (resourceItemsChanged || dropZonesChanged || blocksChanged) {
            DragDropLogger.warn('MONITOR', 'Significant DOM changes detected, re-running setup', {
                resourceItemsChanged,
                dropZonesChanged,
                blocksChanged,
                blockInteractionDetected
            });
            
            // Use longer delay after block interactions to let DOM stabilize
            const delay = blocksChanged ? 300 : 100;
            
            setTimeout(() => {
                setupDragAndDrop();
                DragDropLogger.info('MONITOR', 'Re-ran setupDragAndDrop after DOM changes', {
                    delay,
                    reason: blocksChanged ? 'block interaction' : 'resource/zone change'
                });
                
                // Reset block interaction flag
                if (blocksChanged) {
                    blockInteractionDetected = false;
                }
            }, delay);
        }
    });
    
    // Start observing
    monitorObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['draggable', 'class', 'style']
    });
    
    // Periodic health check - MORE AGGRESSIVE FOR DROP ZONES
    setInterval(() => {
        const state = DragDropLogger.getDragDropState();
        const brokenItems = state.resourceItems.filter(item => 
            item.draggable !== 'true' || !item.hasListeners
        );
        
        // CHECK DROP ZONES TOO!
        const brokenZones = state.dropZones.filter(zone => !zone.hasListeners);
        
        // Check if we recently had block interactions
        const timeSinceBlockRender = Date.now() - lastBlockRenderTime;
        const recentBlockInteraction = timeSinceBlockRender < 10000; // Within last 10 seconds
        
        if (brokenItems.length > 0 || brokenZones.length > 0) {
            DragDropLogger.error('MONITOR', 'Found broken drag-drop elements', {
                brokenItems: brokenItems.length,
                brokenZones: brokenZones.length,
                brokenZoneDetails: brokenZones,
                recentBlockInteraction,
                timeSinceBlockRender: timeSinceBlockRender + 'ms'
            });
            // Auto-repair
            setupDragAndDrop();
            DragDropLogger.warn('MONITOR', 'Auto-repaired drag-drop setup', {
                trigger: recentBlockInteraction ? 'post-block-interaction' : 'periodic-check',
                fixedItems: brokenItems.length,
                fixedZones: brokenZones.length
            });
        } else if (recentBlockInteraction && state.resourceItems.length > 0) {
            // Preemptively refresh after block interactions even if not broken yet
            DragDropLogger.info('MONITOR', 'Preemptive refresh after recent block interaction');
            setupDragAndDrop();
        }
    }, 3000); // Check every 3 seconds (more frequent)
    
    // Monitor for specific block interaction events
    document.addEventListener('click', function(e) {
        // Check if click was on a block-related element
        const target = e.target;
        const isBlockInteraction = 
            target.closest('.content-block') ||
            target.closest('.add-after-btn') ||
            target.closest('.delete-block-btn') ||
            target.closest('.toggle-btn') ||
            target.closest('.convert-btn') ||
            target.closest('.block-heading') ||
            target.closest('.block-content');
            
        if (isBlockInteraction) {
            DragDropLogger.info('MONITOR', 'Block interaction detected via click', {
                element: target.tagName,
                classes: Array.from(target.classList)
            });
            
            // Schedule drag-drop refresh after likely re-render
            setTimeout(() => {
                DragDropLogger.info('MONITOR', 'Refreshing drag-drop after block interaction');
                setupDragAndDrop();
            }, 500);
        }
    }, true);
    
    // Resource count monitoring - check if count changes but DOM doesn't update properly
    resourceCountCheckInterval = setInterval(() => {
        const currentResources = document.querySelectorAll('.resource-item-gradio');
        const currentCount = currentResources.length;
        
        if (currentCount !== lastResourceCount) {
            DragDropLogger.warn('RESOURCE_COUNT', `Resource count changed: ${lastResourceCount} -> ${currentCount}`);
            
            // Check if all resources have drag handlers
            let needsRepair = false;
            currentResources.forEach((item, idx) => {
                if (!item._dragStartHandler || item.getAttribute('draggable') !== 'true') {
                    DragDropLogger.error('RESOURCE_COUNT', `Resource ${idx} missing handlers after count change`);
                    needsRepair = true;
                }
            });
            
            if (needsRepair || currentCount > lastResourceCount) {
                DragDropLogger.info('RESOURCE_COUNT', 'Repairing drag-drop after resource count change');
                setTimeout(() => {
                    setupDragAndDrop();
                    DragDropLogger.success('RESOURCE_COUNT', 'Drag-drop repaired after resource count change');
                }, 100);
            }
            
            lastResourceCount = currentCount;
        }
    }, 1000); // Check every second
    
    // Initialize resource count
    lastResourceCount = document.querySelectorAll('.resource-item-gradio').length;
    DragDropLogger.info('MONITOR', `Initial resource count: ${lastResourceCount}`);
    
    DragDropLogger.success('MONITOR', 'Monitoring system active with resource count tracking');
}

// Debug helper functions for manual troubleshooting
window.debugDragDrop = {
    status: function() {
        return DragDropLogger.dumpState();
    },
    
    repairAll: function() {
        DragDropLogger.info('DEBUG', 'Manual repair requested');
        setupInProgress = false; // Force allow setup
        setupDragAndDrop();
        return 'Drag-drop setup re-initialized';
    },
    
    repairDropZones: function() {
        DragDropLogger.info('DEBUG', 'Repairing drop zones only');
        const dropZones = document.querySelectorAll('.block-resources');
        setupDropZones(dropZones);
        return `Repaired ${dropZones.length} drop zones`;
    },
    
    exportLogs: function() {
        DragDropLogger.exportLogs();
    },
    
    testDrag: function(index = 0) {
        const items = document.querySelectorAll('.resource-item-gradio');
        if (items[index]) {
            const testEvent = new DragEvent('dragstart', { bubbles: true });
            items[index].dispatchEvent(testEvent);
            DragDropLogger.info('DEBUG', `Simulated dragstart on item ${index}`);
        }
    },
    
    checkItem: function(index = 0) {
        const items = document.querySelectorAll('.resource-item-gradio');
        if (items[index]) {
            const item = items[index];
            const pathHidden = item.querySelector('.resource-path-hidden');
            const info = {
                draggable: item.getAttribute('draggable'),
                hasHandlers: !!item._dragStartHandler,
                classList: Array.from(item.classList),
                path: item.dataset.resourcePath,
                actualPath: pathHidden?.getAttribute('data-path') || pathHidden?.textContent?.trim(),
                visible: item.offsetParent !== null,
                dimensions: {
                    width: item.offsetWidth,
                    height: item.offsetHeight
                }
            };
            console.log(`Resource item ${index}:`, info);
            return info;
        }
    },
    
    checkAllItems: function() {
        const items = document.querySelectorAll('.resource-item-gradio');
        console.log(`Total resources: ${items.length}`);
        const details = [];
        items.forEach((item, idx) => {
            const pathHidden = item.querySelector('.resource-path-hidden');
            details.push({
                index: idx,
                path: pathHidden?.getAttribute('data-path') || pathHidden?.textContent?.trim(),
                draggable: item.getAttribute('draggable'),
                hasHandlers: !!item._dragStartHandler
            });
        });
        console.table(details);
        return details;
    },
    
    forceRefresh: function() {
        DragDropLogger.info('DEBUG', 'Forcing complete refresh');
        setupInProgress = false;
        const items = document.querySelectorAll('.resource-item-gradio');
        const zones = document.querySelectorAll('.block-resources');
        DragDropLogger.info('DEBUG', `Found ${items.length} resources and ${zones.length} drop zones`);
        setupDragAndDrop();
        return `Refreshed ${items.length} resources and ${zones.length} drop zones`;
    }
};

// Auto-resize textarea function
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    const newHeight = Math.max(120, textarea.scrollHeight);
    textarea.style.height = newHeight + 'px';
}

// Setup auto-resize for all text block textareas
function setupTextareaAutoResize() {
    const textareas = document.querySelectorAll('.text-block textarea');
    textareas.forEach(textarea => {
        // Auto-resize on input
        textarea.addEventListener('input', function() {
            autoResizeTextarea(this);
        });
        
        // Initial resize in case there's already content
        autoResizeTextarea(textarea);
    });
}

// Run setup when DOM changes (new blocks added)
const textareaObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
            setupTextareaAutoResize();
        }
    });
});

// Start observing
textareaObserver.observe(document.body, {
    childList: true,
    subtree: true
});

// Initial setup
document.addEventListener('DOMContentLoaded', setupTextareaAutoResize);

// Add warning when user tries to leave the page
// Since there's no autosave, always warn users about losing their work
window.addEventListener('beforeunload', function (e) {
    // Custom message (note: most modern browsers show a generic message instead)
    const confirmationMessage = 'Warning: There is no autosave. If you leave this page, all your work will be lost. Make sure to save your document before leaving.';
    
    // Prevent default and set return value for modern browsers
    e.preventDefault();
    e.returnValue = confirmationMessage;
    
    // Return message for older browsers
    return confirmationMessage;
});

function refresh() {
    const url = new URL(window.location);
    elements = document.getElementsByClassName("dark")
    if (elements.length != 0) {
        elements[0].classList.remove("dark");
    }
}


// Toggle debug panel visibility
function toggleDebugPanel() {
    const content = document.getElementById('debug-panel-content');
    const icon = document.getElementById('debug-collapse-icon');

    if (content) {
        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'block';
            if (icon) {
                icon.textContent = '⌵';
                icon.style.transform = 'rotate(180deg)';  // Rotate down chevron to point up
            }
        } else {
            content.style.display = 'none';
            if (icon) {
                icon.textContent = '⌵';
                icon.style.transform = 'rotate(0deg)';  // Normal down chevron
            }
        }
    }
}

// No longer needed - using Gradio's native file upload component

// Process steps hover interaction
document.addEventListener('DOMContentLoaded', function() {
    // Process step visuals
    const stepVisuals = {
        1: {
            svg: `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                    <!-- Document with AI sparkle -->
                    <rect x="100" y="50" width="200" height="250" rx="8" fill="#f0f9f9" stroke="#4a9d9e" stroke-width="2"/>
                    <rect x="120" y="80" width="160" height="8" rx="4" fill="#4a9d9e" opacity="0.3"/>
                    <rect x="120" y="100" width="140" height="8" rx="4" fill="#4a9d9e" opacity="0.3"/>
                    <rect x="120" y="120" width="150" height="8" rx="4" fill="#4a9d9e" opacity="0.3"/>
                    <g transform="translate(250, 70)">
                        <path d="M0,-10 L3,-3 L10,0 L3,3 L0,10 L-3,3 L-10,0 L-3,-3 Z" fill="#4a9d9e" opacity="0.8"/>
                    </g>
                    <rect x="120" y="150" width="160" height="40" rx="4" fill="#e8f5f5" stroke="#4a9d9e" stroke-width="1"/>
                    <rect x="120" y="200" width="160" height="40" rx="4" fill="#e8f5f5" stroke="#4a9d9e" stroke-width="1"/>
                    <rect x="120" y="250" width="160" height="40" rx="4" fill="#e8f5f5" stroke="#4a9d9e" stroke-width="1"/>
                </svg>`,
            caption: "Your document takes shape with AI assistance"
        },
        2: {
            svg: `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                    <!-- Document with edit icon and files -->
                    <rect x="80" y="50" width="180" height="220" rx="8" fill="#f0f9f9" stroke="#4a9d9e" stroke-width="2"/>
                    <!-- Edit pencil -->
                    <g transform="translate(240, 60)">
                        <path d="M0,20 L5,15 L20,0 L25,5 L10,20 Z" fill="#4a9d9e"/>
                        <rect x="0" y="20" width="5" height="5" fill="#4a9d9e"/>
                    </g>
                    <!-- File icons -->
                    <rect x="280" y="80" width="40" height="50" rx="4" fill="#e8f5f5" stroke="#4a9d9e" stroke-width="1"/>
                    <rect x="280" y="140" width="40" height="50" rx="4" fill="#e8f5f5" stroke="#4a9d9e" stroke-width="1"/>
                    <!-- Arrow from files to doc -->
                    <path d="M280,105 L260,150" stroke="#4a9d9e" stroke-width="2" marker-end="url(#arrowhead)"/>
                    <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#4a9d9e"/>
                        </marker>
                    </defs>
                </svg>`,
            caption: "Edit content and update resources as needed"
        },
        3: {
            svg: `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                    <!-- Multiple export formats -->
                    <rect x="50" y="100" width="80" height="100" rx="8" fill="#e8f5f5" stroke="#4a9d9e" stroke-width="2"/>
                    <text x="90" y="155" text-anchor="middle" fill="#4a9d9e" font-size="14" font-weight="bold">PDF</text>
                    <rect x="160" y="100" width="80" height="100" rx="8" fill="#e8f5f5" stroke="#4a9d9e" stroke-width="2"/>
                    <text x="200" y="155" text-anchor="middle" fill="#4a9d9e" font-size="14" font-weight="bold">DOCX</text>
                    <rect x="270" y="100" width="80" height="100" rx="8" fill="#e8f5f5" stroke="#4a9d9e" stroke-width="2"/>
                    <text x="310" y="155" text-anchor="middle" fill="#4a9d9e" font-size="14" font-weight="bold">MD</text>
                    <!-- Export arrow -->
                    <path d="M200,50 L200,80" stroke="#4a9d9e" stroke-width="3" marker-end="url(#arrowhead2)"/>
                    <defs>
                        <marker id="arrowhead2" markerWidth="10" markerHeight="7" refX="5" refY="7" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#4a9d9e"/>
                        </marker>
                    </defs>
                </svg>`,
            caption: "Generate and export in multiple formats"
        }
    };

    // Function to update visual
    function updateProcessVisual(stepNumber) {
        const visualContent = document.querySelector('.visual-content');
        if (visualContent && stepVisuals[stepNumber]) {
            visualContent.innerHTML = stepVisuals[stepNumber].svg +
                `<p class="visual-caption">${stepVisuals[stepNumber].caption}</p>`;
        }
    }

    // Set up hover listeners with delay
    setTimeout(() => {
        const steps = document.querySelectorAll('.start-process-step-vertical');
        steps.forEach((step, index) => {
            step.addEventListener('mouseenter', () => {
                // Remove active class from all steps
                steps.forEach(s => s.classList.remove('active'));
                // Add active class to hovered step
                step.classList.add('active');
                // Update visual
                updateProcessVisual(index + 1);
            });
        });
    }, 1000);
    
    // Setup resource description auto-expand
    setupResourceDescriptionAutoExpand();
});

// Setup auto-expand for resource description textareas
function setupResourceDescriptionAutoExpand() {
    // Find all existing resource description textareas
    const resourceDescTextareas = document.querySelectorAll('.resource-desc-gradio textarea');

    resourceDescTextareas.forEach(textarea => {
        setupSingleResourceDescTextarea(textarea);
    });
    
    // Use MutationObserver to catch dynamically added resource descriptions
    const resourceDescObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Only look for resource desc textareas specifically
                    const newTextareas = node.querySelectorAll ? 
                        node.querySelectorAll('.resource-desc-gradio textarea') : 
                        [];
                    
                    newTextareas.forEach(textarea => {
                        if (!textarea.dataset.autoExpandSetup) {
                            setupSingleResourceDescTextarea(textarea);
                        }
                    });
                    
                    // Also check if the node itself is a resource desc textarea
                    if (node.matches && node.matches('.resource-desc-gradio textarea') && !node.dataset.autoExpandSetup) {
                        setupSingleResourceDescTextarea(node);
                    }
                }
            });
        });
    });
    
    // Start observing, but be more specific about what we watch
    const resourcePanel = document.querySelector('.resources-panel') || document.body;
    resourceDescObserver.observe(resourcePanel, {
        childList: true,
        subtree: true
    });
}

// Setup auto-expand for a single resource description textarea
function setupSingleResourceDescTextarea(textarea) {
    if (textarea.dataset.autoExpandSetup) {
        return; // Already setup
    }
    
    textarea.dataset.autoExpandSetup = 'true';
    
    // Initial sizing
    autoExpandResourceDescription(textarea);
    
    // Add event listeners
    textarea.addEventListener('input', () => {
        autoExpandResourceDescription(textarea);
    });
    
    textarea.addEventListener('paste', () => {
        // Delay to allow paste content to be processed
        setTimeout(() => {
            autoExpandResourceDescription(textarea);
        }, 10);
    });
}


// Function to set up the expandable behavior
function setupExpandableInput() {

    // Try multiple selectors for the prompt input
    const promptInput1 = document.querySelector('#start-prompt-input textarea');
    const promptInput2 = document.querySelector('#start-prompt-input input');
    const promptInput3 = document.querySelector('[id*="start-prompt"] textarea');
    const promptInput4 = document.querySelector('[id*="start-prompt"] input');
    const promptInput = promptInput1 || promptInput2 || promptInput3 || promptInput4;
    
    if (promptInput ) {
        // Expand on focus
        promptInput.addEventListener('focus', () => {
            // Add class to card for styling
            const card = document.querySelector('.start-input-card');
            if (card) card.classList.add('has-expanded');
            
            // Also expand the expandable section
            const expandableSection = document.getElementById('start-expandable-section');
            if (expandableSection) expandableSection.classList.add('expanded');
            
            // Replace file upload text after expansion
            setTimeout(() => {
                const draftFileUpload = document.querySelector('.start-file-upload-dropzone');
                if (draftFileUpload) {
                    const wrapDivs = draftFileUpload.querySelectorAll('.wrap');
                    wrapDivs.forEach(wrapDiv => {
                        if (wrapDiv.textContent.includes('Drop File Here')) {
                            wrapDiv.childNodes.forEach(node => {
                                if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('Drop File Here')) {
                                    node.textContent = node.textContent.replace('Drop File Here', 'Drop Word or Text File Here');
                                }
                            });
                        }
                    });
                }
            }, 100);
        });

        // Function to expand the card
        function expandCard() {
            // Add class to card for styling
            const card = document.querySelector('.start-input-card');
            if (card) card.classList.add('has-expanded');
            
            // Also expand the expandable section
            const expandableSection = document.getElementById('start-expandable-section');
            if (expandableSection) expandableSection.classList.add('expanded');
            
            // Replace file upload text after expansion
            setTimeout(() => {
                const draftFileUpload = document.querySelector('.start-file-upload-dropzone');
                if (draftFileUpload) {
                    const wrapDivs = draftFileUpload.querySelectorAll('.wrap');
                    wrapDivs.forEach(wrapDiv => {
                        if (wrapDiv.textContent.includes('Drop File Here')) {
                            wrapDiv.childNodes.forEach(node => {
                                if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('Drop File Here')) {
                                    node.textContent = node.textContent.replace('Drop File Here', 'Drop Word or Text File Here');
                                }
                            });
                        }
                    });
                }
            }, 100);
        }

        // Expand when example buttons are clicked
        const exampleButtons = document.querySelectorAll('.start-example-btn');
        exampleButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Small delay to ensure the content is loaded first
                setTimeout(expandCard, 100);
            });
        });

        // Collapse when clicking outside
        document.addEventListener('click', (e) => {
            const inputCard = document.querySelector('.start-input-card');
            const expandableArea = document.getElementById('start-expandable-section');
            const isClickInInput = inputCard && inputCard.contains(e.target);
            const isClickInExpandable = expandableArea && expandableArea.contains(e.target);
            const isExampleButton = e.target.closest('.start-example-btn');
            const isRemoveButton = e.target.closest('.remove-resource');

            // Always collapse when clicking outside, unless it's a remove resource button
            if (!isClickInInput && !isClickInExpandable && !isExampleButton && !isRemoveButton) {
                // Remove class from card
                const card = document.querySelector('.start-input-card');
                if (card) card.classList.remove('has-expanded');
                
                // Also collapse the expandable section
                const expandableSection = document.getElementById('start-expandable-section');
                if (expandableSection) expandableSection.classList.remove('expanded');
            }
        });

        return true;
    } else {
        return false;
    }
}

// Try to set up expandable input with exponential backoff
let expandableSetupAttempts = 0;
const maxExpandableAttempts = 4;

function trySetupExpandableInput() {
    if (setupExpandableInput()) {
        return;
    }
    
    expandableSetupAttempts++;
    if (expandableSetupAttempts < maxExpandableAttempts) {
        const delay = 500 * Math.pow(2, expandableSetupAttempts - 1); // 500ms, 1000ms, 2000ms
        setTimeout(trySetupExpandableInput, delay);
    } 
}

// Initial attempt after a short delay
setTimeout(trySetupExpandableInput, 500);

// Also use MutationObserver as backup
const expandableObserver = new MutationObserver((mutations) => {
    if (setupExpandableInput()) {
        expandableObserver.disconnect();
    }
});

expandableObserver.observe(document.body, {
    childList: true,
    subtree: true
});

// Removed watchExpandableState to prevent potential infinite loops

// Function to remove resource from start tab
function removeStartResource(index) {
    // Find the current resources state and update it
    const event = new CustomEvent('remove-start-resource', { detail: { index: index } });
    document.dispatchEvent(event);
}

// Listen for remove resource events and handle them
document.addEventListener('DOMContentLoaded', function() {
    // Set up listener for resource removal
    document.addEventListener('remove-start-resource', function(e) {
        const index = e.detail.index;
        // Trigger a click on the hidden remove buttons that Gradio creates
        const removeButtons = document.querySelectorAll('.start-resources-list button');
        if (removeButtons[index]) {
            // Find the corresponding Gradio button and click it
            const gradioButtons = document.querySelectorAll('[id*="component-"][id*="button"]');
            gradioButtons.forEach(btn => {
                if (btn.textContent === 'Remove' && btn.offsetParent) {
                    btn.click();
                }
            });
        }
    });
});

// Tab switching helper
function switchToDraftTab() {

    // Find all tab buttons
    const tabButtons = document.querySelectorAll('button[role="tab"]'); 

    // Find the Update + Generate tab button and click it (the second tab)
    let found = false;
    tabButtons.forEach(button => {
        if (button.textContent.includes('Update + Generate')) {
            button.click();
            found = true;
        }
    });
}

// Track processed trigger timestamps to prevent repeated switching
let processedTriggers = new Set();

// Check for switch signal in a hidden element
setInterval(() => {
    const switchTrigger = document.getElementById('switch-tab-trigger');
    if (switchTrigger) {
        const currentContent = switchTrigger.innerHTML;
        
        if (currentContent && currentContent.includes('SWITCH_TO_DRAFT_TAB')) {
            // Extract timestamp from the trigger
            const match = currentContent.match(/SWITCH_TO_DRAFT_TAB_(\d+)/);
            if (match) {
                const timestamp = match[1];
                
                // Only process if we haven't seen this timestamp before
                if (!processedTriggers.has(timestamp)) {
                    processedTriggers.add(timestamp);
                    switchToDraftTab();
                    
                    // Clean up old timestamps (keep only last 10)
                    if (processedTriggers.size > 10) {
                        const timestamps = Array.from(processedTriggers).sort();
                        processedTriggers.delete(timestamps[0]);
                    }
                }
            }
        }
    }
}, 100);

// Re-initialize expandable functionality when returning to Start tab
document.addEventListener('click', function(e) {
    // Only show detailed logging for tab clicks to reduce noise
    if (e.target && e.target.getAttribute('role') === 'tab') {
        
        // Try multiple ways to detect Draft tab click (it's called "Draft" not "Start")
        const isDraftTab1 = e.target && e.target.getAttribute('role') === 'tab' && e.target.textContent.includes('Draft');
        const isDraftTab2 = e.target && e.target.textContent && e.target.textContent.trim() === 'Draft';
        const isDraftTab3 = e.target && e.target.classList && e.target.classList.contains('tab') && e.target.textContent.includes('Draft');
        const isDraftTab4 = e.target && e.target.closest('button[role="tab"]') && e.target.textContent.includes('Draft');

        if (isDraftTab1 || isDraftTab2 || isDraftTab3 || isDraftTab4) {
            setTimeout(() => {
                // Reset the setup attempts counter to allow re-setup
                expandableSetupAttempts = 0;
                trySetupExpandableInput();
            }, 100);
        }
    }
});

// Also try using MutationObserver to detect when Start tab becomes visible
const tabObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-selected') {
            const target = mutation.target;
            if (target.textContent && target.textContent.includes('Draft') && target.getAttribute('aria-selected') === 'true') {
                setTimeout(() => {
                    expandableSetupAttempts = 0;
                    trySetupExpandableInput();
                }, 100);
            }
        }
    });
});

// Start observing tab changes
setTimeout(() => {
    const tabContainer = document.querySelector('.tab-nav') || document.querySelector('[role="tablist"]');
    if (tabContainer) {
        tabObserver.observe(tabContainer, {
            attributes: true,
            subtree: true,
            attributeFilter: ['aria-selected']
        });
    }
}, 1000);

// Note: Resource icons now handled by CSS based on tab structure

// Note: Resource delete buttons now use onclick attribute directly

// Monitor for file uploads that add new resources
function monitorFileUploads() {
    DragDropLogger.info('UPLOAD', 'Setting up file upload monitoring');
    
    // Watch for changes in the file upload area
    const uploadObserver = new MutationObserver((mutations) => {
        let uploadDetected = false;
        
        mutations.forEach(mutation => {
            // Check for changes that might indicate file upload
            if (mutation.type === 'childList') {
                const hasNewUpload = 
                    Array.from(mutation.addedNodes).some(node => 
                        node.nodeType === 1 && (
                            node.classList?.contains('resource-item-gradio') ||
                            node.querySelector?.('.resource-item-gradio')
                        )
                    );
                
                if (hasNewUpload) {
                    uploadDetected = true;
                }
            }
        });
        
        if (uploadDetected) {
            DragDropLogger.warn('UPLOAD', 'New file upload detected - resources may have changed');
            
            // Schedule multiple checks to catch the update
            [100, 300, 500, 1000].forEach(delay => {
                setTimeout(() => {
                    const currentCount = document.querySelectorAll('.resource-item-gradio').length;
                    DragDropLogger.info('UPLOAD', `Checking resources after upload (${delay}ms): ${currentCount} items`);
                    
                    // Force setup if we find uninitialized resources
                    const uninitializedItems = Array.from(document.querySelectorAll('.resource-item-gradio'))
                        .filter(item => !item._dragStartHandler || item.getAttribute('draggable') !== 'true');
                    
                    if (uninitializedItems.length > 0) {
                        DragDropLogger.error('UPLOAD', `Found ${uninitializedItems.length} uninitialized resources after upload`);
                        setupDragAndDrop();
                        DragDropLogger.success('UPLOAD', 'Re-initialized drag-drop after file upload');
                    }
                }, delay);
            });
        }
    });
    
    // Try to find the resources container to observe
    setTimeout(() => {
        const resourcesContainer = document.querySelector('.resources-panel') || 
                                  document.querySelector('[id*="resources"]') ||
                                  document.querySelector('.resource-item-gradio')?.parentElement?.parentElement;
        
        if (resourcesContainer) {
            uploadObserver.observe(resourcesContainer, {
                childList: true,
                subtree: true
            });
            DragDropLogger.success('UPLOAD', 'File upload monitoring active');
        } else {
            DragDropLogger.warn('UPLOAD', 'Could not find resources container for upload monitoring');
        }
    }, 1000);
}

// Start file upload monitoring
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', monitorFileUploads);
} else {
    monitorFileUploads();
}

// CRITICAL FIX: Monitor and repair drop zones after toggle clicks
function monitorToggleClicks() {
    DragDropLogger.info('MONITOR', 'Setting up toggle click monitoring');
    
    // Use event delegation to catch all toggle clicks
    document.addEventListener('click', function(e) {
        const target = e.target;
        
        // Check if this is a toggle-related click
        if (target.classList?.contains('toggle-btn') || 
            target.closest('.toggle-btn') ||
            target.classList?.contains('block-heading') ||
            target.closest('.block-heading')) {
            
            DragDropLogger.warn('TOGGLE', 'Toggle/heading click detected - DROP ZONES WILL BREAK!');
            
            // Aggressive repair schedule
            const repairDelays = [50, 150, 300, 500, 750];
            repairDelays.forEach(delay => {
                setTimeout(() => {
                    DragDropLogger.info('TOGGLE', `Repairing drop zones (${delay}ms after toggle)`);
                    
                    // Find and repair all drop zones
                    const zones = document.querySelectorAll('.block-resources');
                    if (zones.length > 0) {
                        // Check if they're actually broken
                        let brokenCount = 0;
                        zones.forEach(zone => {
                            if (!zone._dropHandler) {
                                brokenCount++;
                            }
                        });
                        
                        if (brokenCount > 0) {
                            DragDropLogger.error('TOGGLE', `Found ${brokenCount}/${zones.length} broken drop zones`);
                            setupDropZones(zones);
                            DragDropLogger.success('TOGGLE', 'Drop zones repaired');
                        } else {
                            DragDropLogger.debug('TOGGLE', `All ${zones.length} drop zones still have handlers`);
                        }
                    }
                }, delay);
            });
        }
    }, true); // Use capture phase to catch events early
}

// Start monitoring immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', monitorToggleClicks);
} else {
    monitorToggleClicks();
}

// Delete resource function
function deleteResource(resourcePath) {
    // Set the resource path in the hidden textbox
    const resourcePathInput = document.getElementById('delete-resource-path');

    if (resourcePathInput) {
        // Find the textarea element and set its value
        const textarea = resourcePathInput.querySelector('textarea') || resourcePathInput.querySelector('input[type="text"]');

        if (textarea) {
            textarea.value = resourcePath;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Trigger the hidden delete button
            const deleteButton = document.getElementById('delete-resource-trigger');

            if (deleteButton) {
                deleteButton.click();
            }
        }
    }
}

// Delete block function
function deleteBlock(blockId) {
    // Set the block ID in the hidden textbox
    const blockIdInput = document.getElementById('delete-block-id');

    if (blockIdInput) {
        // Find the textarea element and set its value
        const textarea = blockIdInput.querySelector('textarea') || blockIdInput.querySelector('input[type="text"]');

        if (textarea) {
            textarea.value = blockId;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Trigger the hidden delete button
            setTimeout(() => {
                const deleteBtn = document.getElementById('delete-trigger');

                if (deleteBtn) {
                    deleteBtn.click();
                }
            }, 100);
        }
    }
}

// Update block content function
function updateBlockContent(blockId, content) {
    // Set the block ID and content in hidden inputs
    const blockIdInput = document.getElementById('update-block-id');
    const contentInput = document.getElementById('update-content-input');

    if (blockIdInput && contentInput) {
        const blockIdTextarea = blockIdInput.querySelector('textarea') || blockIdInput.querySelector('input[type="text"]');
        const contentTextarea = contentInput.querySelector('textarea') || contentInput.querySelector('input[type="text"]');

        if (blockIdTextarea && contentTextarea) {
            blockIdTextarea.value = blockId;
            contentTextarea.value = content;

            // Dispatch input events
            blockIdTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            contentTextarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Trigger the update button
            setTimeout(() => {
                const updateBtn = document.getElementById('update-trigger');
 
                if (updateBtn) {
                    updateBtn.click();

                }
            }, 100);
        } 
    }
}

// Update block heading function
function updateBlockHeading(blockId, heading) {
    // Set the block ID and heading in hidden inputs
    const blockIdInput = document.getElementById('update-heading-block-id');
    const headingInput = document.getElementById('update-heading-input');

    if (blockIdInput && headingInput) {
        const blockIdTextarea = blockIdInput.querySelector('textarea') || blockIdInput.querySelector('input[type="text"]');
        const headingTextarea = headingInput.querySelector('textarea') || headingInput.querySelector('input[type="text"]');

        if (blockIdTextarea && headingTextarea) {
            blockIdTextarea.value = blockId;
            headingTextarea.value = heading;

            // Dispatch input events
            blockIdTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            headingTextarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Trigger the update button
            setTimeout(() => {
                const updateBtn = document.getElementById('update-heading-trigger');

                if (updateBtn) {
                    updateBtn.click();
                } 
            }, 100);
        }
    }
}

// Toggle block collapse function
function toggleBlockCollapse(blockId) {
    // Set the block ID in the hidden input
    const blockIdInput = document.getElementById('toggle-block-id');

    if (blockIdInput) {
        const textarea = blockIdInput.querySelector('textarea') || blockIdInput.querySelector('input[type="text"]');

        if (textarea) {
            textarea.value = blockId;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Trigger the hidden toggle button
            setTimeout(() => {
                const toggleBtn = document.getElementById('toggle-trigger');

                if (toggleBtn) {
                    toggleBtn.click();
                } 
            }, 100);
        } 
    } 
}

// Expand block if collapsed when heading is focused
function expandBlockOnHeadingFocus(blockId) {
    // Find the block element using data-id attribute
    const block = document.querySelector(`[data-id="${blockId}"]`);
    if (block && block.classList.contains('collapsed')) {
        // Store reference to the heading input and cursor position
        const headingInput = block.querySelector('.block-heading-inline');
        const cursorPosition = headingInput ? headingInput.selectionStart : 0;

        // If the block is collapsed, expand it
        toggleBlockCollapse(blockId);

        // Use a longer delay and multiple attempts to ensure focus is restored
        let attempts = 0;
        const maxAttempts = 5;

        const restoreFocus = () => {
            attempts++;
            const updatedBlock = document.querySelector(`[data-id="${blockId}"]`);
            const updatedHeading = updatedBlock ? updatedBlock.querySelector('.block-heading-inline') : null;

            if (updatedHeading && !updatedBlock.classList.contains('collapsed')) {
                // Block has expanded, restore focus
                updatedHeading.focus();
                // Restore cursor position
                updatedHeading.setSelectionRange(cursorPosition, cursorPosition);
            } else if (attempts < maxAttempts) {
                // Try again after a short delay
                setTimeout(restoreFocus, 100);
            }
        };

        // Start trying after initial delay
        setTimeout(restoreFocus, 200);
    }
}

// Auto-expand textarea function
function autoExpandTextarea(textarea) {
    // Skip document description - it's handled by setupDescriptionToggle
    const isDocDescription = textarea.closest('#doc-description-id');
    if (isDocDescription) {
        return;
    }

    // Handle resource description textareas specially
    const isResourceDesc = textarea.closest('.resource-desc-gradio');
    if (isResourceDesc) {
        autoExpandResourceDescription(textarea);
        return;
    }
    
    // Skip the main start prompt input - it should maintain its own sizing
    const isStartPromptInput = textarea.closest('#start-prompt-input');
    if (isStartPromptInput) {
        return;
    }

    // For other textareas, use height-based method
    textarea.style.height = 'auto';
    const newHeight = textarea.scrollHeight + 2;
    textarea.style.height = newHeight + 'px';
    textarea.style.maxHeight = '';
    textarea.style.overflow = 'hidden';
    textarea.classList.remove('scrollable');
}

// Auto-expand function specifically for resource descriptions
function autoExpandResourceDescription(textarea) {
    if (!textarea) return;
    
    // Reset height to auto to get accurate scrollHeight
    const originalHeight = textarea.style.height;
    textarea.style.height = 'auto';
    
    // Calculate the needed height more accurately
    const scrollHeight = textarea.scrollHeight;
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(computedStyle.lineHeight) || 15.4; // 11px * 1.4
    const paddingTop = parseFloat(computedStyle.paddingTop) || 4;
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 4;
    const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
    const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
    const totalVerticalPadding = paddingTop + paddingBottom + borderTop + borderBottom;
    
    // Calculate number of lines based on content height
    const contentHeight = scrollHeight - totalVerticalPadding;
    const lines = Math.max(1, Math.round(contentHeight / lineHeight));
    
    // Set minimum of 2 lines, maximum of 8 lines
    const minLines = 2;
    const maxLines = 8;
    const finalLines = Math.max(minLines, Math.min(maxLines, lines));
    
    // Calculate final height
    const finalHeight = (finalLines * lineHeight) + totalVerticalPadding;
    
    // Apply the height with !important to override any CSS
    textarea.style.setProperty('height', finalHeight + 'px', 'important');
    
    // Handle scrolling if content exceeds max lines
    if (lines > maxLines) {
        textarea.style.setProperty('overflow-y', 'auto', 'important');
        textarea.classList.add('scrollable');
    } else {
        textarea.style.setProperty('overflow-y', 'hidden', 'important');
        textarea.classList.remove('scrollable');
    }
    
    // Debug: Check if the height was actually applied
    setTimeout(() => {
        const actualHeight = window.getComputedStyle(textarea).height;
        const actualScrollHeight = textarea.scrollHeight;

        // Only override if there's a significant difference (more than 1px)
        if (Math.abs(parseFloat(actualHeight) - finalHeight) > 1) {
            textarea.setAttribute('style', `height: ${finalHeight}px !important; overflow-y: ${lines > maxLines ? 'auto' : 'hidden'} !important;`);
        }
    }, 100);
}

// Setup auto-expand for all textareas
function setupAutoExpand() {
    // Get all textareas in the document
    const textareas = document.querySelectorAll('textarea');

    textareas.forEach(textarea => {
        // Always setup/re-setup to handle re-renders

        // Initial sizing
        autoExpandTextarea(textarea);

        // Remove existing listeners by using a named function
        if (!textarea.autoExpandHandler) {
            textarea.autoExpandHandler = function() {
                autoExpandTextarea(this);
            };
            textarea.pasteHandler = function() {
                setTimeout(() => autoExpandTextarea(this), 10);
            };

            // Add event listeners
            textarea.addEventListener('input', textarea.autoExpandHandler);
            textarea.addEventListener('paste', textarea.pasteHandler);
        }
    });

    // Special handling for the document description to ensure proper initial height
    const docDescription = document.querySelector('#doc-description-id textarea');
    if (docDescription) {
        // Remove the watcher - it's causing issues
        // The setupDescriptionToggle handles everything needed
    }
}

// Try setting up when DOM loads and with a delay
document.addEventListener('DOMContentLoaded', function () {
    refresh();
    // Upload resource setup no longer needed - using Gradio's native component
    setupAutoExpand();
});

// Reset document description on new document
function resetDocumentDescription() {
    const docDescriptionBox = document.querySelector('.doc-description-box');
    const docDescriptionTextarea = document.querySelector('#doc-description-id textarea');

    if (docDescriptionBox && docDescriptionTextarea) {
        // Clear the textarea value
        docDescriptionTextarea.value = '';


        // Ensure the box is collapsed
        if (!docDescriptionBox.classList.contains('collapsed')) {
            docDescriptionBox.classList.add('collapsed');
        }

        // Reset the textarea height
        docDescriptionTextarea.style.height = 'auto';
        autoExpandTextarea(docDescriptionTextarea);

        // Hide the expand button
        const expandBtn = docDescriptionBox.querySelector('.desc-expand-btn');
        if (expandBtn) {
            expandBtn.style.display = 'none';
        }
    }
}

// Track if we're dragging from an external source
let isDraggingFromExternal = false;

// Clear draggedResource when dragging files from outside the browser
document.addEventListener('dragenter', function(e) {
    // Only clear draggedResource if we don't already have one AND this looks like an external drag
    if (!draggedResource && e.dataTransfer && e.dataTransfer.types) {
        // Check if this is likely an external file drag
        const hasFiles = e.dataTransfer.types.includes('Files') ||
                        e.dataTransfer.types.includes('application/x-moz-file');

        // Also check that it's not coming from our resource items
        const isFromResourceItem = e.target.closest('.resource-item');

        if (hasFiles && !isFromResourceItem && !isDraggingFromExternal) {
            isDraggingFromExternal = true;
            draggedResource = null;
        }
    }
}, true); // Use capture phase to run before other handlers

// Reset the external drag flag when drag ends
document.addEventListener('dragleave', function(e) {
    // Check if we're leaving the document entirely
    if (e.clientX === 0 && e.clientY === 0) {
        isDraggingFromExternal = false;
    }
});

document.addEventListener('drop', function(e) {
    isDraggingFromExternal = false;
});

// Also reset when starting to drag a resource
document.addEventListener('dragstart', function(e) {
    if (e.target.closest('.resource-item')) {
        isDraggingFromExternal = false;
    }
});

// Setup observers for resource title changes in Gradio components
function setupResourceTitleObservers() {
    const resourceItems = document.querySelectorAll('.resource-item-gradio');

    resourceItems.forEach((item, index) => {
        // Find the title textarea
        const titleTextarea = item.querySelector('.resource-title-gradio input');
        const pathDiv = item.querySelector('.resource-path-hidden');

        if (titleTextarea && pathDiv) {
            const resourcePath = pathDiv.getAttribute('data-path') || pathDiv.textContent.trim();
 
            // Remove any existing listener to avoid duplicates
            titleTextarea.removeEventListener('input', titleTextarea._titleUpdateHandler);

            // Create and store the handler function
            titleTextarea._titleUpdateHandler = function() {
                const newTitle = this.value;

                // Immediately update all dropped resources with this path
                const droppedResources = document.querySelectorAll('.dropped-resource[data-resource-path]');

                droppedResources.forEach(dropped => {
                    const droppedPath = dropped.getAttribute('data-resource-path');

                    if (droppedPath === resourcePath) {
                        const titleSpan = dropped.querySelector('.dropped-resource-title');
                        if (titleSpan) {
                            titleSpan.textContent = newTitle;
                        }
                    }
                });
            };

            // Add the event listener
            titleTextarea.addEventListener('input', titleTextarea._titleUpdateHandler);
        }
    });
}

window.addEventListener('load', function() {
    console.log('Window load event fired');
    // Upload resource setup no longer needed - using Gradio's native component
    setTimeout(setupAutoExpand, 100);
    // Also setup drag and drop on window load
    setTimeout(() => {
        DragDropLogger.info('REINIT', 'Re-initializing drag-drop on window load (200ms)');
        setupDragAndDrop();
    }, 200);
    setTimeout(setupFileUploadDragAndDrop, 250);
    // Removed setupDescriptionToggle - causes phantom Gradio events

    // Set up a global observer for the resources column
    setupResourceObserver();

    // Setup title observers for dynamic updates
    setTimeout(() => {
        console.log('About to call setupResourceTitleObservers');
        const resourceItems = document.querySelectorAll('.resource-item-gradio');
        console.log('Found', resourceItems.length, 'resource items before calling setup');
        setupResourceTitleObservers();
    }, 300);
});

// Function to set up observer for resources
function setupResourceObserver() {
    let resourceSetupTimeout;

    // Function to observe a resources area
    function observeResourcesArea(resourcesArea) {
        if (!resourcesArea) return;

        const resourceObserver = new MutationObserver((mutations) => {
            // Clear any pending timeout
            clearTimeout(resourceSetupTimeout);

            // Check if resource items were added
            let hasResourceChanges = false;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 &&
                        (node.classList?.contains('resource-item') ||
                         node.querySelector?.('.resource-item'))) {
                        hasResourceChanges = true;
                    }
                });
            });

            if (hasResourceChanges) {
                DragDropLogger.info('REINIT', 'Resources added, setting up drag and drop');
                
                // Get current count for verification
                const currentCount = document.querySelectorAll('.resource-item-gradio').length;
                DragDropLogger.info('REINIT', `Current resource count after change: ${currentCount}`);
                
                // Wait a bit for DOM to stabilize then setup drag and drop
                resourceSetupTimeout = setTimeout(() => {
                    DragDropLogger.info('REINIT', 'Re-initializing drag-drop after resources changed');
                    
                    // Double-check the count before setup
                    const preSetupCount = document.querySelectorAll('.resource-item-gradio').length;
                    DragDropLogger.info('REINIT', `Resource count before setup: ${preSetupCount}`);
                    
                    setupDragAndDrop();
                    setupResourceTitleObservers();
                    
                    // Verify after setup
                    const postSetupCount = document.querySelectorAll('.resource-item-gradio').length;
                    DragDropLogger.info('REINIT', `Resource count after setup: ${postSetupCount}`);
                }, 200);
            }
        });

        resourceObserver.observe(resourcesArea, {
            childList: true,
            subtree: true
        });

        return resourceObserver;
    }

    // Initial setup
    let currentObserver = observeResourcesArea(document.querySelector('.resources-display-area'));

    // Also watch for the resources area itself being replaced
    const columnObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    const newResourcesArea = node.classList?.contains('resources-display-area') ?
                        node : node.querySelector?.('.resources-display-area');

                    if (newResourcesArea) {
                        console.log('Resources area replaced, setting up new observer');
                        // Disconnect old observer if it exists
                        if (currentObserver) {
                            currentObserver.disconnect();
                        }
                        // Set up new observer
                        currentObserver = observeResourcesArea(newResourcesArea);
                        // Setup drag and drop for any existing items
                        setTimeout(() => {
                            DragDropLogger.info('REINIT', 'Re-initializing drag-drop after tab switch (200ms)');
                            setupDragAndDrop();
                        }, 200);
                        // Setup title observers too
                        setTimeout(setupResourceTitleObservers, 300);
                    }
                }
            });
        });
    });

    // Observe the resources column for replacements
    const resourcesCol = document.querySelector('.resources-col');
    if (resourcesCol) {
        columnObserver.observe(resourcesCol, {
            childList: true,
            subtree: true
        });
    }
}

// Prevent dropping resources on text inputs and file upload zones
function preventInvalidDrops() {
    // Helper function to check if element is invalid drop target
    function isInvalidDropTarget(element) {
        if (!element) return false;

        // Check if it's a text input
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            return true;
        }

        // Check if it's part of a file upload component (Gradio file upload)
        if (element.closest('.resource-upload-gradio') ||
            element.closest('[data-testid="file"]') ||
            element.classList.contains('resource-upload-gradio')) {
            return true;
        }

        return false;
    }

    // Prevent drop on invalid targets
    document.addEventListener('dragover', function(e) {
        if (isInvalidDropTarget(e.target)) {
            if (draggedResource || window.currentDraggedResource) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'none';
                e.target.classList.add('no-drop');
            }
        }
    }, true);

    document.addEventListener('dragleave', function(e) {
        if (isInvalidDropTarget(e.target)) {
            e.target.classList.remove('no-drop');
        }
    }, true);

    document.addEventListener('drop', function(e) {
        if (isInvalidDropTarget(e.target)) {
            if (draggedResource || window.currentDraggedResource) {
                e.preventDefault();
                e.stopPropagation();
                e.target.classList.remove('no-drop');
                console.log('Prevented drop on invalid target:', e.target);
            }
        }
    }, true);

    // Clean up no-drop class when drag ends
    document.addEventListener('dragend', function(e) {
        document.querySelectorAll('.no-drop').forEach(el => {
            el.classList.remove('no-drop');
        });
    }, true);
}

// Call it once when the page loads
preventInvalidDrops();

// Use MutationObserver for dynamic content
let debounceTimer;
const observer = new MutationObserver(function(mutations) {
    // Check if any mutations are relevant (new nodes added)
    let hasRelevantChanges = false;

    for (const mutation of mutations) {
        // Only care about added nodes
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Check if any added nodes contain textareas or are blocks
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) { // Element node
                    if (node.classList?.contains('content-block') ||
                        node.classList?.contains('resource-item') ||
                        node.classList?.contains('resource-item-gradio') ||
                        node.classList?.contains('block-resources') ||
                        node.querySelector?.('textarea') ||
                        node.querySelector?.('.resource-item') ||
                        node.querySelector?.('.resource-item-gradio') ||
                        node.querySelector?.('.block-resources') ||
                        node.tagName === 'TEXTAREA') {
                        hasRelevantChanges = true;
                        // Log when we detect resource items
                        if (node.classList?.contains('resource-item') ||
                            node.classList?.contains('resource-item-gradio') ||
                            node.querySelector?.('.resource-item') ||
                            node.querySelector?.('.resource-item-gradio')) {
                            console.log('Detected resource item change');
                        }
                        break;
                    }
                }
            }
        }
    }

    // Only run setup if relevant changes detected
    if (hasRelevantChanges) {
        refresh();
        // Upload resource setup no longer needed - using Gradio's native component
        setupImportButton();

        // Delay drag and drop setup slightly to ensure DOM is ready
        setTimeout(() => {
            DragDropLogger.info('REINIT', 'Re-initializing drag-drop after blocks rendered');
            setupDragAndDrop();
            setupFileUploadDragAndDrop();
            setupResourceTitleObservers();
        }, 50);

        // Debounce the setupAutoExpand to avoid multiple calls
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            setupAutoExpand();
            // Removed setupDescriptionToggle() - causes phantom Gradio events
            setupExampleSelection();
            setupDownloadDropdown();
            // Removed setupResourceDescriptions() - causes phantom Gradio events
            setupResourceUploadZones();
            setupResourceUploadText();
            preventResourceDrops();
        }, 100);
    }
});

if (document.body) {
    observer.observe(document.body, {
        childList: true,
        subtree: true
        // Removed attributes observation - we don't need it
    });
}

// Update block indent function
function updateBlockIndent(blockId, direction) {

    // Set focused block when indenting
    setFocusedBlock(blockId);

    // Set the block ID and direction in hidden inputs
    const blockIdInput = document.getElementById('indent-block-id');
    const directionInput = document.getElementById('indent-direction');

    if (blockIdInput && directionInput) {
        const blockIdTextarea = blockIdInput.querySelector('textarea') || blockIdInput.querySelector('input[type="text"]');
        const directionTextarea = directionInput.querySelector('textarea') || directionInput.querySelector('input[type="text"]');

        if (blockIdTextarea && directionTextarea) {
            blockIdTextarea.value = blockId;
            directionTextarea.value = direction;

            // Dispatch input events
            blockIdTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            directionTextarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Trigger the update button
            setTimeout(() => {
                const indentBtn = document.getElementById('indent-trigger');

                if (indentBtn) {
                    indentBtn.click();
                }
            }, 100);
        }
    }
}

// Set focused block function
function setFocusedBlock(blockId, skipRender = false) {

    const focusIdInput = document.getElementById('focus-block-id');

    if (focusIdInput) {
        const textarea = focusIdInput.querySelector('textarea') || focusIdInput.querySelector('input[type="text"]');

        if (textarea) {
            textarea.value = blockId;

            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Only trigger render if not skipping
            if (!skipRender) {
                setTimeout(() => {
                    const focusBtn = document.getElementById('focus-trigger');

                    if (focusBtn) {
                        focusBtn.click();

                    }
                }, 100);
            }
        }
    }
}


// Add block after function - adds same type as the block being clicked
function addBlockAfter(blockId) {
    // Get the block element to determine its type
    const blockElement = document.querySelector(`[data-id="${blockId}"]`);
    if (blockElement) {
        // Determine type based on class
        let blockType = 'ai'; // default
        if (blockElement.classList.contains('text-block')) {
            blockType = 'text';
        }

        // Set the values in hidden inputs
        const blockIdInput = document.getElementById('add-after-block-id');
        const typeInput = document.getElementById('add-after-type');

        if (blockIdInput && typeInput) {
            const blockIdTextarea = blockIdInput.querySelector('textarea') || blockIdInput.querySelector('input[type="text"]');
            const typeTextarea = typeInput.querySelector('textarea') || typeInput.querySelector('input[type="text"]');

            if (blockIdTextarea && typeTextarea) {
                blockIdTextarea.value = blockId;
                typeTextarea.value = blockType;

                // Dispatch input events
                blockIdTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                typeTextarea.dispatchEvent(new Event('input', { bubbles: true }));

                // Trigger the add after button
                setTimeout(() => {
                    const addAfterBtn = document.getElementById('add-after-trigger');
                    if (addAfterBtn) {
                        addAfterBtn.click();
                    }
                }, 100);
            }
        }
    }
}

// Convert block type function
function convertBlock(blockId, toType) {

    // Set the values in hidden inputs
    const blockIdInput = document.getElementById('convert-block-id');
    const typeInput = document.getElementById('convert-type');

    if (blockIdInput && typeInput) {
        const blockIdTextarea = blockIdInput.querySelector('textarea') || blockIdInput.querySelector('input[type="text"]');
        const typeTextarea = typeInput.querySelector('textarea') || typeInput.querySelector('input[type="text"]');

        if (blockIdTextarea && typeTextarea) {
            blockIdTextarea.value = blockId;
            typeTextarea.value = toType;

            // Dispatch input events
            blockIdTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            typeTextarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Trigger the convert button
            setTimeout(() => {
                const convertBtn = document.getElementById('convert-trigger');

                if (convertBtn) {
                    convertBtn.click();

                    // Focus the textarea after conversion
                    setTimeout(() => {
                        const block = document.querySelector(`[data-id="${blockId}"]`);

                        if (block) {
                            const textarea = block.querySelector('textarea') || block.querySelector('input[type="text"]');

                            if (textarea) {
                                textarea.focus();
                            }
                        }
                    }, 200);
                }
            }, 100);
        }
    }
}

// Focus textarea within a block
function focusBlockTextarea(blockId) {
    const block = document.querySelector(`[data-id="${blockId}"]`);
    if (block) {
        const textarea = block.querySelector('textarea') || block.querySelector('input[type="text"]');
        if (textarea) {
            textarea.focus();
        }
    }
}

// Delete resource from panel function
function deleteResourceFromPanel(resourcePath) {
    // Set the value in hidden input
    const resourcePathInput = document.getElementById('delete-panel-resource-path');

    if (resourcePathInput) {
        const resourcePathTextarea = resourcePathInput.querySelector('textarea') || resourcePathInput.querySelector('input[type="text"]');

        if (resourcePathTextarea) {
            resourcePathTextarea.value = resourcePath;

            // Dispatch input event
            resourcePathTextarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Trigger the delete button
            setTimeout(() => {
                const deleteBtn = document.getElementById('delete-panel-resource-trigger');
                if (deleteBtn) {
                    deleteBtn.click();
                }
            }, 100);
        }
    }
}

// Remove resource from block function
function removeBlockResource(blockId, resourcePath) {
    console.log('removeBlockResource called with blockId:', blockId, 'resourcePath:', resourcePath);
    // Set the values in hidden inputs
    const blockIdInput = document.getElementById('remove-resource-block-id');
    const resourcePathInput = document.getElementById('remove-resource-path');
    console.log('Block ID input:', blockIdInput, 'Resource path input:', resourcePathInput);

    if (blockIdInput && resourcePathInput) {
        const blockIdTextarea = blockIdInput.querySelector('textarea') || blockIdInput.querySelector('input[type="text"]');
        const resourcePathTextarea = resourcePathInput.querySelector('textarea') || resourcePathInput.querySelector('input[type="text"]');
        console.log('Block ID textarea:', blockIdTextarea, 'Resource path textarea:', resourcePathTextarea);

        if (blockIdTextarea && resourcePathTextarea) {
            blockIdTextarea.value = blockId;
            resourcePathTextarea.value = resourcePath;
            console.log('Set values in textareas');

            // Dispatch input events
            blockIdTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            resourcePathTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('Dispatched input events');

            // Trigger the remove button
            setTimeout(() => {
                const removeBtn = document.getElementById('remove-resource-trigger');
                console.log('Remove resource trigger button:', removeBtn);

                if (removeBtn) {
                    removeBtn.click();
                    console.log('Clicked remove resource trigger button');
                } else {
                    console.error('Remove resource trigger button not found!');
                }
            }, 100);
        } else {
            console.error('One or both textareas not found!');
        }
    } else {
        console.error('One or both input containers not found!');
    }
}

// Debounce timer for resource descriptions
let descriptionDebounceTimers = {};

// Update resource description function with debouncing
function updateResourceDescription(blockId, resourcePath, description) {
    // Create unique key for this input
    const timerKey = `${blockId}-${resourcePath}`;

    // Clear existing timer for this input
    if (descriptionDebounceTimers[timerKey]) {
        clearTimeout(descriptionDebounceTimers[timerKey]);
    }

    // Update all other description text boxes for the same resource immediately
    const allDescInputs = document.querySelectorAll('.resource-description');
    allDescInputs.forEach(input => {
        // Check if this input is for the same resource but different block
        if (input.getAttribute('oninput') &&
            input.getAttribute('oninput').includes(`'${resourcePath}'`) &&
            !input.getAttribute('oninput').includes(`'${blockId}'`)) {
            input.value = description;
        }
    });

    // Set new timer with 50ms delay (0.05 seconds after user stops typing)
    descriptionDebounceTimers[timerKey] = setTimeout(() => {
        // Set the values in hidden inputs
        const blockIdInput = document.getElementById('update-desc-block-id');
        const resourcePathInput = document.getElementById('update-desc-resource-path');
        const descTextInput = document.getElementById('update-desc-text');

        if (blockIdInput && resourcePathInput && descTextInput) {
            const blockIdTextarea = blockIdInput.querySelector('textarea') || blockIdInput.querySelector('input[type="text"]');
            const resourcePathTextarea = resourcePathInput.querySelector('textarea') || resourcePathInput.querySelector('input[type="text"]');
            const descTextTextarea = descTextInput.querySelector('textarea') || descTextInput.querySelector('input[type="text"]');

            if (blockIdTextarea && resourcePathTextarea && descTextTextarea) {
                blockIdTextarea.value = blockId;
                resourcePathTextarea.value = resourcePath;
                descTextTextarea.value = description;

                // Dispatch input events
                blockIdTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                resourcePathTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                descTextTextarea.dispatchEvent(new Event('input', { bubbles: true }));

                // Trigger the update button
                setTimeout(() => {
                    const updateBtn = document.getElementById('update-desc-trigger');
                    if (updateBtn) {
                        updateBtn.click();
                    }
                }, 100);
            }
        }

        // Clean up timer reference
        delete descriptionDebounceTimers[timerKey];
    }, 50); // Wait 50ms after user stops typing
}

// Load resource content into text block
function loadResourceContent(blockId, resourcePath) {
    // Set the values in hidden inputs
    const blockIdInput = document.getElementById('load-resource-block-id');
    const resourcePathInput = document.getElementById('load-resource-path');

    if (blockIdInput && resourcePathInput) {
        const blockIdTextarea = blockIdInput.querySelector('textarea') || blockIdInput.querySelector('input[type="text"]');
        const resourcePathTextarea = resourcePathInput.querySelector('textarea') || resourcePathInput.querySelector('input[type="text"]');

        if (blockIdTextarea && resourcePathTextarea) {
            blockIdTextarea.value = blockId;
            resourcePathTextarea.value = resourcePath;

            // Dispatch input events
            blockIdTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            resourcePathTextarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Trigger the load button
            setTimeout(() => {
                const loadBtn = document.getElementById('load-resource-trigger');
                if (loadBtn) {
                    loadBtn.click();
                }
            }, 100);
        }
    }
}

// Setup description expand/collapse button
function setupDescriptionToggle() {
    const container = document.querySelector('#doc-description-id');
    const textarea = container?.querySelector('textarea') || container?.querySelector('input[type="text"]');

    if (!container || !textarea || container.dataset.toggleSetup) {
        return;
    }

    // Mark as setup
    container.dataset.toggleSetup = 'true';

    // Create expand/collapse button
    const button = document.createElement('button');
    button.className = 'desc-expand-btn';
    button.innerHTML = '⌵'; // Down chevron
    button.title = 'Collapse';

    // Find the input container (parent of textarea) and insert button there
    const inputContainer = textarea.parentElement;
    if (inputContainer) {
        inputContainer.style.position = 'relative'; // Ensure container is positioned
        inputContainer.appendChild(button);
    }

    // Track collapsed state and full text
    let isCollapsed = false;
    let fullText = '';

    // Function to get first two lines of text
    function getFirstTwoLines(text) {
        const lines = text.split('\n');
        // Take first two lines
        let firstTwo = lines.slice(0, 2).join('\n');

        // If the second line exists and there's more content, add ellipsis
        if (lines.length > 2 || (lines.length === 2 && lines[1].length > 50)) {
            firstTwo += '...';
        }

        return firstTwo;
    }

    // Function to check if button should be visible
    function checkButtonVisibility() {
        if (isCollapsed) return;

        // Count actual lines in the textarea
        const lines = textarea.value.split('\n');
        let totalLines = lines.length; // Start with actual line breaks

        // Add wrapped lines - estimate ~80 chars per line for wider doc description
        lines.forEach((line, index) => {
            if (line.length > 80) {
                // Add extra lines for wrapping
                totalLines += Math.floor(line.length / 80);
            }
        });

        console.log('Doc desc - lines:', lines.length, 'totalLines:', totalLines);

        // Show button if content exceeds 2 lines
        if (totalLines > 2) {
            button.style.display = 'block';
        } else {
            button.style.display = 'none';
        }

        // Set rows attribute based on content, no max
        let rowsToShow = Math.max(2, totalLines);

        // Add 1 extra row if we have 3 or more rows for breathing room
        if (rowsToShow >= 3) {
            rowsToShow += 1;
        }

        console.log('Setting rows to:', rowsToShow);

        textarea.rows = rowsToShow;
        textarea.style.height = 'auto'; // Use auto instead of empty string
        textarea.style.minHeight = 'auto';
        textarea.style.maxHeight = 'none';
        textarea.style.overflow = 'hidden';

        // Never add scrollable class
        textarea.classList.remove('scrollable');
    }

    // Toggle collapse/expand
    function toggleCollapse() {
        const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight);
        const padding = parseInt(window.getComputedStyle(textarea).paddingTop) +
                       parseInt(window.getComputedStyle(textarea).paddingBottom);
        const twoLinesHeight = (lineHeight * 2) + padding;

        if (isCollapsed) {
            // Expand - restore full text
            textarea.value = fullText;
            textarea.style.height = ''; // Clear height
            textarea.style.maxHeight = ''; // Remove max height
            textarea.style.overflow = 'hidden'; // No scrollbars
            container.classList.remove('collapsed');
            button.innerHTML = '⌵';
            button.title = 'Collapse';
            isCollapsed = false;
            textarea.classList.remove('scrollable'); // Remove scrollable class
            checkButtonVisibility(); // Use checkButtonVisibility like resources
            // Keep focus without moving cursor
            textarea.focus();

            // Trigger input event to update Gradio's state
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            // Collapse - save full text and show only first 2 lines
            fullText = textarea.value;
            textarea.value = getFirstTwoLines(fullText);
            textarea.rows = 2; // Force 2 rows
            textarea.style.height = ''; // Let rows control height
            textarea.style.maxHeight = ''; // Clear max height
            textarea.style.overflow = 'hidden';
            container.classList.add('collapsed');
            button.innerHTML = '⌵';  // Same chevron, will rotate with CSS
            button.title = 'Expand';
            isCollapsed = true;
            textarea.classList.remove('scrollable'); // Remove scrollable class when collapsed
            // Remove focus to prevent scrolling
            textarea.blur();
        }
    }

    // Button click handler
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCollapse();
    });

    // Click on collapsed textarea to expand
    textarea.addEventListener('click', (e) => {
        if (isCollapsed) {
            // Get cursor position before expanding
            const cursorPos = textarea.selectionStart;
            toggleCollapse();
            // Restore cursor position after expanding
            setTimeout(() => {
                textarea.setSelectionRange(cursorPos, cursorPos);
            }, 0);
        }
    });

    // Check on input
    textarea.addEventListener('input', () => {
        // Only update if not collapsed (unless typing to expand)
        if (!isCollapsed) {
            checkButtonVisibility();
        } else if (textarea.value !== getFirstTwoLines(fullText)) {
            // If collapsed and user is typing (not just the truncated value), expand
            toggleCollapse();
        }
    });

    // Also handle paste
    textarea.addEventListener('paste', function() {
        setTimeout(() => {
            if (!isCollapsed) {
                checkButtonVisibility();
            }
        }, 10);
    });

    // Initial check
    checkButtonVisibility();
}

// Also add a global function that can be called
window.setupAutoExpand = setupAutoExpand;

// Setup import button functionality
function setupImportButton() {
    const importBtn = document.getElementById('import-builder-btn-id');

    if (importBtn) {
        // Remove any existing listeners first
        importBtn.replaceWith(importBtn.cloneNode(true));
        const newImportBtn = document.getElementById('import-builder-btn-id');

        newImportBtn.addEventListener('click', function(e) {
            console.log('Import button clicked');
            e.preventDefault();
            e.stopPropagation();

            // Find the import file input - it's inside the button element in Gradio 5.x
            const importFileInput = document.querySelector('#import-file-input button input[type="file"]');
            console.log('Import file input found:', importFileInput);

            if (importFileInput) {
                importFileInput.click();
            } else {
                console.error('Import file input not found');
            }
        });
    }
}

// Setup drag and drop for file upload zone
function setupFileUploadDragAndDrop() {
    const fileUploadZone = document.querySelector('.file-upload-dropzone');
    if (!fileUploadZone) return;

    // Function to replace the text
    function replaceDropText() {
        const wrapDivs = document.querySelectorAll('.file-upload-dropzone .wrap');
        wrapDivs.forEach(wrapDiv => {
            if (wrapDiv.textContent.includes('Drop File Here')) {
                wrapDiv.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('Drop File Here')) {
                        node.textContent = node.textContent.replace('Drop File Here', 'Drop Word or Text File Here');
                    }
                });
            }
            // Also handle the draft tab text
            if (wrapDiv.textContent.includes('Drop File Here')) {
                wrapDiv.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('Drop File Here')) {
                        node.textContent = node.textContent.replace('Drop File Here', 'Drop Word or Text File Here');
                    }
                });
            }
        });
    }

    // Try to replace immediately
    replaceDropText();

    // Watch for changes in case the content is dynamically updated
    const observer = new MutationObserver((mutations) => {
        replaceDropText();
    });

    observer.observe(fileUploadZone, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // Stop observing after 5 seconds to avoid performance issues
    setTimeout(() => observer.disconnect(), 5000);

    // Also setup resource upload zones
    setupResourceUploadText();
    
    // Setup draft tab file upload text monitoring
    setupDraftTabFileUpload();
    
    // Function to run text replacement after card expansion
    function runTextReplacementAfterExpansion() {
        setTimeout(() => {
            const draftFileUpload = document.querySelector('.start-file-upload-dropzone');
            if (draftFileUpload) {
                const wrapDivs = draftFileUpload.querySelectorAll('.wrap');
                wrapDivs.forEach(wrapDiv => {
                    if (wrapDiv.textContent.includes('Drop File Here')) {
                        wrapDiv.childNodes.forEach(node => {
                            if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('Drop File Here')) {
                                node.textContent = node.textContent.replace('Drop File Here', 'Drop Word or Text File Here');
                            }
                        });
                    }
                });
            }
        }, 200); // Delay to let expansion animation complete
    }
    
    // Add event listeners for card expansion triggers
    document.addEventListener('click', function(e) {
        // Check if click is on input/textarea or example button that might expand the card
        if (e.target.matches('input, textarea, button') || 
            e.target.closest('.doc-title-box, .doc-description-box, .start-feature-item')) {
            runTextReplacementAfterExpansion();
        }
    });
    
    document.addEventListener('focus', function(e) {
        // Check if focus is on input that might expand the card
        if (e.target.matches('input, textarea')) {
            runTextReplacementAfterExpansion();
        }
    }, true); // Use capture phase to catch focus events early

    // Add drag-over class when dragging files over the upload zone
    let dragCounter = 0;

    function addDragListeners(element) {
        element.addEventListener('dragenter', function(e) {
            e.preventDefault();
            // Only show drag-over effect if not dragging a resource
            if (!draggedResource) {
                dragCounter++;
                fileUploadZone.classList.add('drag-over');
            }
        });

        element.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            // If dragging a resource, show "not allowed" cursor
            if (draggedResource) {
                e.dataTransfer.dropEffect = 'none';
            } else {
                fileUploadZone.classList.add('drag-over');
            }
        });

        element.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                fileUploadZone.classList.remove('drag-over');
            }
        });

        element.addEventListener('drop', function(e) {
            dragCounter = 0;
            fileUploadZone.classList.remove('drag-over');
            // Block resource drops completely
            if (draggedResource) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            // For file drops, let Gradio handle it - don't prevent default
        });
    }

    // Add listeners to the main zone
    addDragListeners(fileUploadZone);

    // Also add to all child elements to ensure we catch all events
    const allChildren = fileUploadZone.querySelectorAll('*');
    allChildren.forEach(child => {
        addDragListeners(child);
    });

    // Watch for new elements being added and attach listeners
    const dragObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    addDragListeners(node);
                    const newChildren = node.querySelectorAll('*');
                    newChildren.forEach(child => addDragListeners(child));
                }
            });
        });
    });

    dragObserver.observe(fileUploadZone, {
        childList: true,
        subtree: true
    });

    // Stop observing after 5 seconds
    setTimeout(() => dragObserver.disconnect(), 5000);
}

// Track setup calls to prevent infinite loops
let setupInProgress = false;
let lastSetupTime = 0;

// Drag and drop functionality for resources
function setupDragAndDrop() {
    // Prevent rapid re-setup  
    const now = Date.now();
    if (setupInProgress || (now - lastSetupTime) < 50) {
        DragDropLogger.debug('SETUP', 'Skipping setup - too soon or already in progress', {
            setupInProgress,
            timeSinceLastSetup: now - lastSetupTime
        });
        return;
    }
    
    setupInProgress = true;
    lastSetupTime = now;
    
    DragDropLogger.info('SETUP', 'Starting drag and drop setup');
    
    // Log current DOM state
    const initialState = DragDropLogger.getDragDropState();
    DragDropLogger.debug('SETUP', 'Initial DOM state', initialState);
    
    // Log broken zones specifically
    const brokenZones = initialState.dropZones.filter(z => !z.hasListeners);
    if (brokenZones.length > 0) {
        DragDropLogger.warn('SETUP', `Found ${brokenZones.length} drop zones without listeners`, brokenZones);
    }

    // Setup draggable resources - now look for Gradio resource components
    const resourceItems = document.querySelectorAll('.resource-item-gradio');
    DragDropLogger.info('SETUP', `Found ${resourceItems.length} Gradio resource items`);
    
    // Log details about each resource for debugging
    if (resourceItems.length > 0) {
        const resourceDetails = [];
        resourceItems.forEach((item, idx) => {
            const pathHidden = item.querySelector('.resource-path-hidden');
            const path = pathHidden?.getAttribute('data-path') || pathHidden?.textContent?.trim();
            resourceDetails.push({
                index: idx,
                path: path,
                hasDragHandler: !!item._dragStartHandler,
                isDraggable: item.getAttribute('draggable') === 'true'
            });
        });
        DragDropLogger.debug('SETUP', 'Resource details', resourceDetails);
    }

    resourceItems.forEach((item, index) => {
        DragDropLogger.debug('SETUP', `Processing resource item ${index}`, {
            element: item,
            currentDraggable: item.getAttribute('draggable'),
            classList: Array.from(item.classList)
        });
        
        // Make sure the item is draggable
        const wasDraggable = item.getAttribute('draggable');
        item.setAttribute('draggable', 'true');
        
        if (wasDraggable !== 'true') {
            DragDropLogger.warn('SETUP', `Resource item ${index} was not draggable, fixed`, {
                wasDraggable,
                nowDraggable: item.getAttribute('draggable')
            });
        }

        // Just store the path on the element for reference during drag
        const pathHidden = item.querySelector('.resource-path-hidden');
        if (pathHidden) {
            const path = pathHidden.getAttribute('data-path') || pathHidden.textContent.trim();
            item.dataset.resourcePath = path;
            DragDropLogger.debug('SETUP', `Resource ${index} path set`, { path });
        } else {
            DragDropLogger.warn('SETUP', `Resource ${index} has no path element`);
        }

        // Also make child elements not draggable to prevent conflicts
        const inputs = item.querySelectorAll('input, textarea, button');
        inputs.forEach(input => {
            input.setAttribute('draggable', 'false');
        });
        DragDropLogger.debug('SETUP', `Disabled dragging on ${inputs.length} child inputs for resource ${index}`);

        // Check if listeners already exist
        const hasExistingListeners = item._dragStartHandler || item._dragEndHandler;
        
        // Remove existing listeners to avoid duplicates
        if (item._dragStartHandler) {
            item.removeEventListener('dragstart', item._dragStartHandler);
            DragDropLogger.debug('SETUP', `Removed existing dragstart listener for resource ${index}`);
        }
        if (item._dragEndHandler) {
            item.removeEventListener('dragend', item._dragEndHandler);
            DragDropLogger.debug('SETUP', `Removed existing dragend listener for resource ${index}`);
        }

        // Create wrapped handlers to track them
        item._dragStartHandler = function(e) {
            DragDropLogger.debug('EVENT', `dragstart triggered on resource ${index}`);
            handleDragStart.call(this, e);
        };
        item._dragEndHandler = function(e) {
            DragDropLogger.debug('EVENT', `dragend triggered on resource ${index}`);
            handleDragEnd.call(this, e);
        };

        // Add new listeners
        item.addEventListener('dragstart', item._dragStartHandler);
        item.addEventListener('dragend', item._dragEndHandler);
        
        DragDropLogger.success('SETUP', `Resource ${index} setup complete`, {
            draggable: item.getAttribute('draggable'),
            hasListeners: true,
            path: item.dataset.resourcePath
        });
    });

    // Setup drop zones
    const dropZones = document.querySelectorAll('.block-resources');
    DragDropLogger.info('SETUP', `Found ${dropZones.length} drop zones`);

    if (dropZones.length === 0) {
        DragDropLogger.warn('SETUP', 'No drop zones found! Blocks might not be rendered yet.');
        // Try again after a short delay
        setTimeout(() => {
            const retryDropZones = document.querySelectorAll('.block-resources');
            DragDropLogger.info('SETUP', `Retry - Found ${retryDropZones.length} drop zones`);
            if (retryDropZones.length > 0) {
                setupDropZones(retryDropZones);
            } else {
                DragDropLogger.error('SETUP', 'Still no drop zones found after retry');
            }
        }, 500);
    } else {
        setupDropZones(dropZones);
    }
    
    DragDropLogger.success('SETUP', 'Drag and drop setup completed');
    
    // Final verification
    const finalState = DragDropLogger.getDragDropState();
    const stillBrokenZones = finalState.dropZones.filter(z => !z.hasListeners);
    if (stillBrokenZones.length > 0) {
        DragDropLogger.error('SETUP', `WARNING: ${stillBrokenZones.length} drop zones STILL without listeners after setup!`, stillBrokenZones);
    }
    
    DragDropLogger.dumpState();
    setupInProgress = false;
}

function setupDropZones(dropZones) {
    DragDropLogger.info('DROPZONE', `Setting up ${dropZones.length} drop zones`);
    
    // First, verify drop zones are valid
    const validZones = Array.from(dropZones).filter(zone => {
        const isValid = zone && zone.nodeType === 1 && zone.offsetParent !== null;
        if (!isValid) {
            DragDropLogger.warn('DROPZONE', 'Skipping invalid drop zone', {
                exists: !!zone,
                nodeType: zone?.nodeType,
                visible: zone?.offsetParent !== null
            });
        }
        return isValid;
    });
    
    DragDropLogger.info('DROPZONE', `${validZones.length} valid drop zones out of ${dropZones.length}`);
    
    validZones.forEach((zone, index) => {
        const blockId = zone.closest('.content-block')?.id;
        const blockDataId = zone.closest('.content-block')?.dataset?.id;
        
        DragDropLogger.debug('DROPZONE', `Processing drop zone ${index}`, {
            blockId,
            blockDataId,
            classList: Array.from(zone.classList),
            hasParentBlock: !!zone.closest('.content-block')
        });
        
        // Check for existing listeners
        const hasExistingListeners = zone._dragEnterHandler || zone._dragOverHandler || 
                                     zone._dropHandler || zone._dragLeaveHandler;
        
        // Remove existing listeners to avoid duplicates
        if (zone._dragEnterHandler) {
            zone.removeEventListener('dragenter', zone._dragEnterHandler);
            DragDropLogger.debug('DROPZONE', `Removed existing dragenter listener for zone ${index}`);
        }
        if (zone._dragOverHandler) {
            zone.removeEventListener('dragover', zone._dragOverHandler);
            DragDropLogger.debug('DROPZONE', `Removed existing dragover listener for zone ${index}`);
        }
        if (zone._dropHandler) {
            zone.removeEventListener('drop', zone._dropHandler);
            DragDropLogger.debug('DROPZONE', `Removed existing drop listener for zone ${index}`);
        }
        if (zone._dragLeaveHandler) {
            zone.removeEventListener('dragleave', zone._dragLeaveHandler);
            DragDropLogger.debug('DROPZONE', `Removed existing dragleave listener for zone ${index}`);
        }

        // Create wrapped handlers to track them
        zone._dragEnterHandler = function(e) {
            DragDropLogger.debug('EVENT', `dragenter on zone ${index}`, { blockId });
            handleDragEnter.call(this, e);
        };
        zone._dragOverHandler = function(e) {
            handleDragOver.call(this, e);
        };
        zone._dropHandler = function(e) {
            DragDropLogger.debug('EVENT', `drop on zone ${index}`, { blockId });
            handleDrop.call(this, e);
        };
        zone._dragLeaveHandler = function(e) {
            DragDropLogger.debug('EVENT', `dragleave on zone ${index}`, { blockId });
            handleDragLeave.call(this, e);
        };

        // Add new listeners
        zone.addEventListener('dragenter', zone._dragEnterHandler);
        zone.addEventListener('dragover', zone._dragOverHandler);
        zone.addEventListener('drop', zone._dropHandler);
        zone.addEventListener('dragleave', zone._dragLeaveHandler);

        // Add data attribute to help debug
        zone.setAttribute('data-drop-zone-index', index);
        
        DragDropLogger.success('DROPZONE', `Drop zone ${index} setup complete`, {
            blockId,
            hasListeners: true
        });
    });
    
    DragDropLogger.success('DROPZONE', 'All drop zones configured');
    
    // Verify handlers are actually attached
    setTimeout(() => {
        const zones = document.querySelectorAll('.block-resources');
        let brokenCount = 0;
        zones.forEach((zone, idx) => {
            if (!zone._dropHandler) {
                brokenCount++;
                DragDropLogger.error('DROPZONE', `Zone ${idx} missing handlers after setup!`);
            }
        });
        if (brokenCount > 0) {
            DragDropLogger.error('DROPZONE', `${brokenCount} zones failed to attach handlers`);
        }
    }, 100);
}

let draggedResource = null;

function handleDragStart(e) {
    DragDropLogger.info('DRAG', 'handleDragStart called', {
        target: e.target,
        targetTag: e.target.tagName,
        targetClasses: Array.from(e.target.classList)
    });

    // Prevent dragging when clicking on input elements
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
        DragDropLogger.warn('DRAG', 'Prevented drag from input element', { tagName: e.target.tagName });
        e.preventDefault();
        return;
    }

    // For Gradio components, we need to extract data differently
    const resourceElement = e.target.closest('.resource-item-gradio');
    if (resourceElement) {
        DragDropLogger.info('DRAG', 'Resource element found', {
            element: resourceElement,
            draggable: resourceElement.getAttribute('draggable')
        });

        // Always extract current values dynamically to get latest updates
        DragDropLogger.info('DRAG', 'Extracting current resource data');

        // Look for elements - Gradio might have nested structures
        const titleInput = resourceElement.querySelector('.resource-title-gradio input[type="text"], .resource-title-gradio textarea');
        const descInput = resourceElement.querySelector('.resource-desc-gradio textarea');
        const pathDiv = resourceElement.querySelector('.resource-path-hidden');
        const filenameDiv = resourceElement.querySelector('.resource-filename');

        // Debug logging
        const elementState = {
            titleInput: !!titleInput,
            titleInputType: titleInput?.tagName,
            titleValue: titleInput?.value,
            descInput: !!descInput,
            descValue: descInput?.value,
            pathDiv: !!pathDiv,
            pathData: pathDiv?.getAttribute('data-path'),
            pathText: pathDiv?.textContent?.trim(),
            filenameDiv: !!filenameDiv,
            filenameText: filenameDiv?.textContent?.trim()
        };
        DragDropLogger.debug('DRAG', 'Found elements', elementState);

        if (pathDiv && filenameDiv) {
            const path = pathDiv.getAttribute('data-path') || pathDiv.textContent.trim();
            const filename = filenameDiv.textContent.trim();
            // Get title from input/textarea value, fallback to filename
            const title = titleInput && titleInput.value ? titleInput.value.trim() : filename;
            const description = descInput && descInput.value ? descInput.value.trim() : '';

            draggedResource = {
                name: filename,
                title: title,
                path: path,
                type: 'text',
                description: description
            };
            
            DragDropLogger.success('DRAG', 'Dynamically extracted resource', {
                resource: draggedResource,
                titleSource: titleInput && titleInput.value ? 'input' : 'filename',
                hasDescription: !!description
            });
        } else {
            DragDropLogger.error('DRAG', 'Missing required elements for resource extraction', {
                hasPathDiv: !!pathDiv,
                hasFilenameDiv: !!filenameDiv
            });
        }

        if (draggedResource) {
            DragDropLogger.success('DRAG', 'Started dragging resource', {
                resource: draggedResource,
                elementClasses: Array.from(resourceElement.classList)
            });
            
            resourceElement.classList.add('dragging');
            document.body.classList.add('dragging-resource');
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', JSON.stringify(draggedResource));

            // Set global variable to ensure it persists
            window.currentDraggedResource = draggedResource;
            window.draggedResource = draggedResource;
            
            DragDropLogger.debug('DRAG', 'Set global drag state', {
                windowCurrentDraggedResource: !!window.currentDraggedResource,
                windowDraggedResource: !!window.draggedResource,
                localDraggedResource: !!draggedResource
            });
        } else {
            DragDropLogger.error('DRAG', 'Could not extract resource data for drag', {
                resourceElement: !!resourceElement,
                pathDiv: !!pathDiv,
                filenameDiv: !!filenameDiv
            });
        }
    }
}

function handleDragEnd(e) {
    DragDropLogger.info('DRAG', 'handleDragEnd called');
    
    // For Gradio components
    const resourceElement = e.target.closest('.resource-item-gradio');
    if (resourceElement) {
        resourceElement.classList.remove('dragging');
        DragDropLogger.debug('DRAG', 'Removed dragging class from resource element');
    } else {
        e.target.classList.remove('dragging');
        DragDropLogger.debug('DRAG', 'Removed dragging class from target');
    }

    // Remove dragging class from body
    document.body.classList.remove('dragging-resource');

    // Clear draggedResource after a small delay to ensure drop completes
    setTimeout(() => {
        DragDropLogger.debug('DRAG', 'Clearing dragged resource state (100ms delay)');
        draggedResource = null;
        window.currentDraggedResource = null;
        window.draggedResource = null;
    }, 100);
}

function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const resource = draggedResource || window.currentDraggedResource || window.draggedResource;
    const blockId = e.currentTarget.closest('.content-block')?.dataset?.id;
    
    DragDropLogger.debug('DROP', 'handleDragEnter', {
        hasResource: !!resource,
        resourceFrom: draggedResource ? 'local' : (window.currentDraggedResource ? 'window.current' : 'window.dragged'),
        blockId,
        targetClasses: Array.from(e.currentTarget.classList)
    });

    if (resource) {
        e.currentTarget.classList.add('drag-over');
        DragDropLogger.debug('DROP', 'Added drag-over class to drop zone');
    } else {
        DragDropLogger.warn('DROP', 'No resource found during dragEnter');
    }
}

function handleDragOver(e) {
    // Only prevent default for valid drop zones
    if (e.currentTarget.classList.contains('block-resources')) {
        e.preventDefault();
        e.stopPropagation();

        const resource = draggedResource || window.currentDraggedResource || window.draggedResource;

        // Debug logging - reduce verbosity
        if (!e.currentTarget.dataset.loggedOnce) {
            const blockId = e.currentTarget.closest('.content-block')?.dataset?.id;
            DragDropLogger.debug('DROP', 'handleDragOver (first time)', {
                hasResource: !!resource,
                blockId,
                dropEffect: e.dataTransfer.dropEffect
            });
            e.currentTarget.dataset.loggedOnce = 'true';
        }

        // Only show drag-over effect if we're dragging a resource from the panel
        if (resource) {
            // Try different drop effects to get the right cursor
            e.dataTransfer.dropEffect = 'copy';
            e.currentTarget.classList.add('drag-over');

            // Force cursor style
            e.currentTarget.style.cursor = 'copy';
        } else if (!e.currentTarget.dataset.warnedOnce) {
            DragDropLogger.warn('DROP', 'No resource during dragOver');
            e.currentTarget.dataset.warnedOnce = 'true';
        }
    }
}

function handleDragLeave(e) {
    const blockId = e.currentTarget.closest('.content-block')?.dataset?.id;
    DragDropLogger.debug('DROP', 'handleDragLeave', { blockId });
    
    e.currentTarget.classList.remove('drag-over');
    e.currentTarget.style.cursor = '';
    
    // Reset logging flags
    delete e.currentTarget.dataset.loggedOnce;
    delete e.currentTarget.dataset.warnedOnce;
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const resource = draggedResource || window.currentDraggedResource || window.draggedResource;

    DragDropLogger.info('DROP', 'handleDrop triggered', {
        hasResource: !!resource,
        resourceFrom: draggedResource ? 'local' : (window.currentDraggedResource ? 'window.current' : 'window.dragged'),
        dropZoneIndex: e.currentTarget.getAttribute('data-drop-zone-index'),
        targetClasses: Array.from(e.currentTarget.classList)
    });

    if (!resource) {
        DragDropLogger.error('DROP', 'No dragged resource found', {
            localDraggedResource: !!draggedResource,
            windowCurrentDraggedResource: !!window.currentDraggedResource,
            windowDraggedResource: !!window.draggedResource
        });
        DragDropLogger.dumpState();
        return;
    }

    // Find the block ID from the parent content block
    const contentBlock = e.currentTarget.closest('.content-block');
    if (!contentBlock) {
        DragDropLogger.error('DROP', 'No parent content block found', {
            currentTargetClasses: e.currentTarget.className,
            parentElement: e.currentTarget.parentElement?.tagName,
            parentClasses: e.currentTarget.parentElement?.className
        });
        return;
    }

    const blockId = contentBlock.dataset.id;
    DragDropLogger.success('DROP', 'Dropping resource on block', {
        blockId,
        resource: resource
    });

    // Update the block's resources
    updateBlockResources(blockId, resource);

    // Clear both variables and remove body class
    draggedResource = null;
    window.currentDraggedResource = null;
    window.draggedResource = null;
    document.body.classList.remove('dragging-resource');
    
    DragDropLogger.info('DROP', 'Drop completed and state cleared');
}

// Function to update block resources
function updateBlockResources(blockId, resource) {
    DragDropLogger.info('UPDATE', 'updateBlockResources called', {
        blockId,
        resource
    });

    // Set the values in hidden inputs
    const blockIdInput = document.getElementById('update-resources-block-id');
    const resourceInput = document.getElementById('update-resources-input');
    
    DragDropLogger.debug('UPDATE', 'Found hidden inputs', {
        hasBlockIdInput: !!blockIdInput,
        hasResourceInput: !!resourceInput
    });

    if (blockIdInput && resourceInput) {
        const blockIdTextarea = blockIdInput.querySelector('textarea') || blockIdInput.querySelector('input[type="text"]');
        const resourceTextarea = resourceInput.querySelector('textarea') || resourceInput.querySelector('input[type="text"]');
        
        DragDropLogger.debug('UPDATE', 'Found textareas', {
            hasBlockIdTextarea: !!blockIdTextarea,
            hasResourceTextarea: !!resourceTextarea
        });

        if (blockIdTextarea && resourceTextarea) {
            // Set block ID
            blockIdTextarea.value = blockId;
            DragDropLogger.debug('UPDATE', 'Set block ID in textarea', { blockId });

            // Set resource JSON
            const resourceJson = JSON.stringify(resource);
            resourceTextarea.value = resourceJson;
            DragDropLogger.debug('UPDATE', 'Set resource JSON in textarea', { resourceJson });

            // Dispatch input events
            blockIdTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            DragDropLogger.debug('UPDATE', 'Dispatched input event for block ID');

            resourceTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            DragDropLogger.debug('UPDATE', 'Dispatched input event for resource');

            // Trigger the update button
            setTimeout(() => {
                const updateBtn = document.getElementById('update-resources-trigger');
                
                if (updateBtn) {
                    updateBtn.click();
                    DragDropLogger.success('UPDATE', 'Clicked update resources trigger button');
                } else {
                    DragDropLogger.error('UPDATE', 'Update resources trigger button not found!');
                    DragDropLogger.dumpState();
                }
            }, 100);
        } else {
            DragDropLogger.error('UPDATE', 'One or both textareas not found!', {
                blockIdTextarea: !!blockIdTextarea,
                resourceTextarea: !!resourceTextarea
            });
            DragDropLogger.dumpState();
        }
    } else {
        DragDropLogger.error('UPDATE', 'One or both input containers not found!', {
            blockIdInput: !!blockIdInput,
            resourceInput: !!resourceInput
        });
        DragDropLogger.dumpState();
    }
}

// Setup example selection functionality
function setupExampleSelection() {
    const exampleItems = document.querySelectorAll('.examples-dropdown-item');

    exampleItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            const exampleId = this.getAttribute('data-example');

            // Set the example ID in hidden input
            const exampleIdInput = document.getElementById('example-id-input');
            if (exampleIdInput) {
                const textarea = exampleIdInput.querySelector('textarea') || exampleIdInput.querySelector('input[type="text"]');
                if (textarea) {
                    textarea.value = exampleId;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));

                    // Trigger the load example button
                    setTimeout(() => {
                        const loadExampleBtn = document.getElementById('load-example-trigger');
                        if (loadExampleBtn) {
                            loadExampleBtn.click();

                            // Removed setupResourceDescriptions() - causes phantom Gradio events
                            // setTimeout(() => {
                            //     setupResourceDescriptions();
                            //     // Doc description will be handled by the interval watcher
                            // }, 500);
                        }
                    }, 100);
                }
            }

            // Hide dropdown after selection
            const dropdown = document.getElementById('examples-dropdown-id');
            if (dropdown) {
                dropdown.style.display = 'none';
                // Re-show on next hover
                setTimeout(() => {
                    dropdown.style.removeProperty('display');
                }, 300);
            }
        });
    });
}

// Setup download dropdown functionality
function setupDownloadDropdown() {
    const downloadItems = document.querySelectorAll('.download-dropdown-item');
    
    downloadItems.forEach((item, index) => {
        // Check if already has listener
        if (item.dataset.listenerAttached === 'true') {
            return; // Skip if already has listener
        }
        
        item.dataset.listenerAttached = 'true'; // Mark as having listener
        
        item.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const format = this.getAttribute('data-format');
            
            // Set the format in hidden input - Gradio may change IDs in production
            let formatInput = document.getElementById('download-format-input');
            
            if (formatInput) {
                // Gradio textbox can have textarea or input nested inside
                let textarea = formatInput.querySelector('textarea') || 
                              formatInput.querySelector('input[type="text"]') ||
                              formatInput.querySelector('input');
                              
                // Sometimes the gradio-textbox itself contains the value property
                if (!textarea && formatInput.classList && formatInput.classList.contains('gradio-textbox')) {
                    // Look deeper in the Gradio structure
                    const wrapper = formatInput.querySelector('.wrap');
                    if (wrapper) {
                        textarea = wrapper.querySelector('textarea') || wrapper.querySelector('input');
                    }
                }
                
                if (textarea) {
                    textarea.value = format;
                    
                    // Try multiple event types
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    textarea.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Trigger the format selection handler
                    setTimeout(() => {
                        let downloadTrigger = document.getElementById('download-format-trigger');
                        
                        // If not found by ID, search for hidden button
                        if (!downloadTrigger) {
                            const hiddenButtons = document.querySelectorAll('button[style*="display: none"], .gradio-button[style*="display: none"]');
                            // Look for a button that's not the download button
                            for (let btn of hiddenButtons) {
                                if (!btn.id?.includes('download-btn') && !btn.classList.contains('download')) {
                                    downloadTrigger = btn;
                                    break;
                                }
                            }
                        }
                        
                        if (downloadTrigger) {
                            downloadTrigger.click();
                                     
                            // After format is set, trigger the hidden download button
                            setTimeout(() => {
                                let hiddenDownloadBtn = document.getElementById('hidden-download-btn');
                                
                                // If not found by ID, search for Gradio download button
                                if (!hiddenDownloadBtn) {

                                    // Look for hidden download button components
                                    const downloadButtons = document.querySelectorAll('.gradio-downloadbutton[style*="display: none"], [class*="download"][style*="display: none"]');
                                    if (downloadButtons.length > 0) {
                                        hiddenDownloadBtn = downloadButtons[0];
                                    }
                                }
                                
                                if (hiddenDownloadBtn) {
                                    // Find the actual button element (might be nested)
                                    const actualBtn = hiddenDownloadBtn.querySelector('button') || hiddenDownloadBtn;
                                    if (actualBtn) {
                                        actualBtn.click();
                                    }
                                }
                            }, 200);
                        }
                    }, 200);
                }
            }
            
            // Hide dropdown after selection
            const dropdown = document.getElementById('download-dropdown-id');
            if (dropdown) {
                dropdown.style.display = 'none';
                // Re-show on next hover
                setTimeout(() => {
                    dropdown.style.removeProperty('display');
                }, 300);
            }
        });
    });
}

// Set up observer for workspace collapse button changes
// No longer needed since we handle the class in Python
function setupWorkspaceCollapseObserver() {
    // Empty function kept for compatibility
}

// Debounce timer for resource titles
let titleDebounceTimers = {};

// Update resource title function with debouncing
function updateResourceTitle(resourcePath, newTitle) {
    // Create unique key for this input
    const timerKey = resourcePath;

    // Clear existing timer for this input
    if (titleDebounceTimers[timerKey]) {
        clearTimeout(titleDebounceTimers[timerKey]);
    }

    // Update data attributes on the resource item for dragging
    const resourceItems = document.querySelectorAll('.resource-item');
    resourceItems.forEach(item => {
        if (item.getAttribute('data-resource-path') === resourcePath) {
            item.setAttribute('data-resource-title', newTitle);
        }
    });

    // Immediately update all dropped resources in AI blocks with this path
    const droppedResources = document.querySelectorAll('.dropped-resource[data-resource-path]');
    droppedResources.forEach(dropped => {
        // Check if this dropped resource matches the path
        if (dropped.getAttribute('data-resource-path') === resourcePath) {
            // Find the title span and update it
            const titleSpan = dropped.querySelector('.dropped-resource-title');
            if (titleSpan) {
                titleSpan.textContent = newTitle;
            }
        }
    });

    // Set new timer with 50ms delay (0.05 seconds after user stops typing)
    titleDebounceTimers[timerKey] = setTimeout(() => {
        // Set the values in hidden inputs
        const pathInput = document.getElementById('update-title-resource-path');
        const titleInput = document.getElementById('update-title-text');

        if (pathInput && titleInput) {
            const pathTextarea = pathInput.querySelector('textarea') || pathInput.querySelector('input[type="text"]');
            const titleTextarea = titleInput.querySelector('textarea') || titleInput.querySelector('input[type="text"]');

            if (pathTextarea && titleTextarea) {
                pathTextarea.value = resourcePath;
                titleTextarea.value = newTitle;

                // Dispatch input events
                pathTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                titleTextarea.dispatchEvent(new Event('input', { bubbles: true }));

                // Trigger the update button
                setTimeout(() => {
                    const updateBtn = document.getElementById('update-title-trigger');
                    if (updateBtn) {
                        updateBtn.click();
                    }
                }, 100);
            }
        }

        // Clean up timer reference
        delete titleDebounceTimers[timerKey];
    }, 50); // Wait 50ms after user stops typing
}

// Debounce timer for resource panel descriptions
let panelDescriptionDebounceTimers = {};

// Update resource description from panel with debouncing
function updateResourcePanelDescription(resourcePath, newDescription) {
    // Create unique key for this input
    const timerKey = `panel-${resourcePath}`;

    // Clear existing timer for this input
    if (panelDescriptionDebounceTimers[timerKey]) {
        clearTimeout(panelDescriptionDebounceTimers[timerKey]);
    }

    // Set new timer with 50ms delay
    panelDescriptionDebounceTimers[timerKey] = setTimeout(() => {
        // Set the values in hidden inputs - reusing the title inputs as per Python code
        const pathInput = document.getElementById('update-title-resource-path');
        const descInput = document.getElementById('update-title-text');

        if (pathInput && descInput) {
            const pathTextarea = pathInput.querySelector('textarea') || pathInput.querySelector('input[type="text"]');
            const descTextarea = descInput.querySelector('textarea') || descInput.querySelector('input[type="text"]');

            if (pathTextarea && descTextarea) {
                pathTextarea.value = resourcePath;
                descTextarea.value = newDescription;

                // Dispatch input events
                pathTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                descTextarea.dispatchEvent(new Event('input', { bubbles: true }));

                // Trigger the update button for description
                setTimeout(() => {
                    const updateBtn = document.getElementById('update-panel-desc-trigger');
                    if (updateBtn) {
                        updateBtn.click();
                    }
                }, 100);
            }
        }

        // Clean up timer reference
        delete panelDescriptionDebounceTimers[timerKey];
    }, 50);
}

// Toggle resource description collapse/expand
function toggleResourceDescription(resourceId) {
    const resourceItem = document.getElementById(resourceId);
    if (resourceItem) {
        const container = resourceItem.querySelector('.resource-description-container');
        const textarea = container.querySelector('.resource-panel-description');
        const button = container.querySelector('.desc-expand-btn');

        const lineHeight = 11 * 1.4; // 11px font * 1.4 line-height
        const padding = 8; // 4px top + 4px bottom
        const twoLinesHeight = (lineHeight * 2) + padding;

        // Function to get first two lines with ellipsis
        function getFirstTwoLinesWithEllipsis(text) {
            if (!text) return '';
            const lines = text.split('\n');
            let firstTwo = lines.slice(0, 2).join('\n');

            // Add ellipsis if there's more content
            if (lines.length > 2 || (lines.length === 2 && lines[1].length > 20)) {
                firstTwo += '...';
            }
            return firstTwo;
        }

        if (container.classList.contains('collapsed')) {
            // Expand - restore original text
            container.classList.remove('collapsed');
            button.innerHTML = '⌵';
            button.title = 'Collapse';
            textarea.value = textarea.dataset.originalValue || textarea.value.replace(/\.\.\.$/,'');
            textarea.style.height = 'auto';
            textarea.style.maxHeight = '180px';
            textarea.style.overflow = ''; // Reset to CSS default
            textarea.classList.remove('scrollable');
            container.classList.remove('has-scrollbar');

            // Recalculate height and scrollability
            const scrollHeight = textarea.scrollHeight;
            textarea.style.height = Math.min(scrollHeight, 180) + 'px';
            if (scrollHeight > 180) {
                textarea.classList.add('scrollable');
                container.classList.add('has-scrollbar');
            }

            // Restore cursor position if available
            if (textarea.dataset.cursorPos) {
                const cursorPos = parseInt(textarea.dataset.cursorPos);
                textarea.focus();
                textarea.setSelectionRange(cursorPos, cursorPos);
                delete textarea.dataset.cursorPos;
            } else {
                textarea.focus();
            }
        } else {
            // Collapse - save original and show first 2 lines with ellipsis
            textarea.dataset.originalValue = textarea.value;
            container.classList.add('collapsed');
            button.innerHTML = '⌵';
            button.title = 'Expand';
            textarea.value = getFirstTwoLinesWithEllipsis(textarea.dataset.originalValue);
            textarea.style.height = twoLinesHeight + 'px';
            textarea.style.maxHeight = twoLinesHeight + 'px';
            textarea.style.overflow = 'hidden';
            textarea.classList.remove('scrollable');
            container.classList.remove('has-scrollbar');
            textarea.blur();
        }
    }
}

// Setup auto-expand for resource descriptions
function setupResourceDescriptions() {
    // Handle Gradio resource descriptions
    const gradioDescTextareas = document.querySelectorAll('.resource-desc-gradio textarea');

    gradioDescTextareas.forEach(textarea => {
        const container = textarea.closest('.resource-desc-gradio');
        if (!container || container.dataset.toggleSetup) {
            return;
        }

        // Mark as setup
        container.dataset.toggleSetup = 'true';

        // Create expand/collapse button
        const button = document.createElement('button');
        button.className = 'desc-expand-btn';
        button.innerHTML = '⌵'; // Down chevron
        button.title = 'Collapse';
        button.style.display = 'none'; // Hidden by default

        // Add button to container
        container.appendChild(button);

        // Track collapsed state and full text
        let isCollapsed = false;
        let fullText = '';

        // Function to get first two lines of text
        function getFirstTwoLines(text) {
            const lines = text.split('\n');

            // Always show exactly 2 lines
            if (lines.length === 1) {
                // If only one line, just return it with ellipsis if it's long
                return lines[0].length > 50 ? lines[0].substring(0, 47) + '...' : lines[0];
            } else if (lines.length >= 2) {
                // Get exactly first two lines
                const firstLine = lines[0];
                const secondLine = lines[1];

                // If there are more than 2 lines or the second line is long, add ellipsis
                if (lines.length > 2 || secondLine.length > 50) {
                    // Truncate second line if needed to make room for ellipsis
                    const truncatedSecond = secondLine.length > 47 ? secondLine.substring(0, 47) : secondLine;
                    return firstLine + '\n' + truncatedSecond + '...';
                } else {
                    return firstLine + '\n' + secondLine;
                }
            }

            return text;
        }

        // Function to check if button should be visible
        function checkButtonVisibility() {
            if (isCollapsed) return;

            // Count actual lines in the textarea
            const lines = textarea.value.split('\n');
            let totalLines = lines.length; // Start with actual line breaks

            // Add wrapped lines - more accurate estimation
            // Resource panel is narrower, estimate ~35 chars per line at 11px font
            lines.forEach((line, index) => {
                if (line.length > 35) {
                    // Add extra lines for wrapping
                    totalLines += Math.floor(line.length / 35);
                }
            });

            // Show button if content exceeds 2 lines
            if (totalLines > 2) {
                button.style.display = 'block';
            } else {
                button.style.display = 'none';
            }

            // Set rows attribute based on content, no max
            let rowsToShow = Math.max(2, totalLines);

            // Add 1 extra row if we have 3 or more rows for breathing room
            if (rowsToShow >= 3) {
                rowsToShow += 1;
            }

            textarea.rows = rowsToShow;
            textarea.style.height = ''; // Let rows attribute control height
            textarea.style.minHeight = ''; // Clear any min-height
            textarea.style.maxHeight = ''; // Clear any max-height
            textarea.style.overflow = 'hidden'; // No scrollbars

            // Never add scrollable class
            textarea.classList.remove('scrollable');
        }

        // Toggle collapse/expand
        function toggleCollapse() {
            if (isCollapsed) {
                // Expand
                textarea.value = fullText;
                textarea.style.height = ''; // Clear height to let rows control it
                container.classList.remove('collapsed');
                button.innerHTML = '⌵';
                button.title = 'Collapse';
                isCollapsed = false;
                // Don't set rows to null - let checkButtonVisibility set it
                checkButtonVisibility();
                textarea.focus();

                // Trigger input event to update Gradio's state
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                // Collapse
                fullText = textarea.value;
                textarea.value = getFirstTwoLines(fullText);
                textarea.rows = 2; // Force exactly 2 rows
                textarea.style.height = ''; // Let rows attribute control height
                container.classList.add('collapsed');
                button.innerHTML = '⌵';
                button.title = 'Expand';
                isCollapsed = true;
                textarea.classList.remove('scrollable');
                textarea.blur();
            }
        }

        // Button click handler
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleCollapse();
        });

        // Click on collapsed textarea to expand
        textarea.addEventListener('click', (e) => {
            if (isCollapsed) {
                const cursorPos = textarea.selectionStart;
                toggleCollapse();
                setTimeout(() => {
                    textarea.setSelectionRange(cursorPos, cursorPos);
                }, 0);
            }
        });

        // Check on input
        textarea.addEventListener('input', () => {
            checkButtonVisibility();
            if (isCollapsed) {
                toggleCollapse();
            }
        });

        // Initial check
        checkButtonVisibility();

        // If textarea has initial content, ensure proper display
        if (textarea.value && textarea.value.split('\n').length > 2) {
            checkButtonVisibility();
        }

        // Watch for value changes (e.g., from imports)
        const observer = new MutationObserver(() => {
            if (!isCollapsed && textarea.value !== fullText) {
                checkButtonVisibility();
            }
        });

        observer.observe(textarea, {
            attributes: true,
            attributeFilter: ['value']
        });

        // Also listen for programmatic value changes
        let lastValue = textarea.value;
        setInterval(() => {
            if (textarea.value !== lastValue && !isCollapsed) {
                lastValue = textarea.value;
                checkButtonVisibility();
            }
        }, 500);
    });

    // Also handle the old panel descriptions if they exist
    const descTextareas = document.querySelectorAll('.resource-panel-description');

    descTextareas.forEach(textarea => {
        // Store original value without ellipsis
        if (!textarea.dataset.originalValue) {
            textarea.dataset.originalValue = textarea.value;
        }

        // Set minimum height for 2 lines
        const lineHeight = 11 * 1.4; // 11px font * 1.4 line-height
        const padding = 8; // 4px top + 4px bottom
        const minHeight = (lineHeight * 2) + padding;
        textarea.style.minHeight = minHeight + 'px';

        // Function to get first two lines with ellipsis
        function getFirstTwoLinesWithEllipsis(text) {
            if (!text) return '';
            const lines = text.split('\n');
            let firstTwo = lines.slice(0, 2).join('\n');

            // Add ellipsis if there's more content
            if (lines.length > 2 || (lines.length === 2 && lines[1].length > 20)) {
                firstTwo += '...';
            }
            return firstTwo;
        }

        // Auto-expand handler
        const autoExpand = function() {
            const container = this.closest('.resource-description-container');
            const button = container.querySelector('.desc-expand-btn');
            const isCollapsed = container.classList.contains('collapsed');

            // Store original value if typing
            if (!isCollapsed && this === document.activeElement) {
                this.dataset.originalValue = this.value;
            }

            if (!isCollapsed) {
                // Reset height to auto to get correct scrollHeight
                this.style.height = 'auto';
                const scrollHeight = this.scrollHeight;

                // Set height to scrollHeight, capped at max-height (180px)
                const newHeight = Math.min(scrollHeight, 180);
                this.style.height = newHeight + 'px';

                // Add scrollable class only if content exceeds 10 lines
                // Check against newHeight (before capping) to show scrollbar when starting 11th line
                const lineHeight = 11 * 1.4; // 11px font * 1.4 line-height
                const padding = 8; // 4px top + 4px bottom
                const tenLinesHeight = (lineHeight * 10) + padding;

                if (this.style.height === 'auto' && this.scrollHeight > tenLinesHeight) {
                    this.classList.add('scrollable');
                    container.classList.add('has-scrollbar');
                } else if (parseFloat(this.style.height) >= 180) {
                    // Also check if we're at max height
                    this.classList.add('scrollable');
                    container.classList.add('has-scrollbar');
                } else {
                    this.classList.remove('scrollable');
                    container.classList.remove('has-scrollbar');
                }

                // Check button visibility - moved inside the !isCollapsed block
                // Get actual computed line height and padding
                const computedLineHeight = parseFloat(window.getComputedStyle(this).lineHeight);
                const computedPadding = parseInt(window.getComputedStyle(this).paddingTop) +
                                       parseInt(window.getComputedStyle(this).paddingBottom);
                const computedTwoLinesHeight = (computedLineHeight * 2) + computedPadding;

                // Reset height temporarily to get accurate scrollHeight
                const currentHeight = this.style.height;
                this.style.height = 'auto';
                const actualScrollHeight = this.scrollHeight;
                this.style.height = currentHeight;

                // Count actual lines of text
                const lines = this.value.split('\n');
                let actualLineCount = 0;
                for (let line of lines) {
                    // Count wrapped lines too - approximate based on line length
                    // Resource panel is about 170px wide, ~15-20 chars per line at 11px font
                    actualLineCount += 1 + Math.floor(line.length / 20);
                }

                // Show button only when starting the 3rd line (similar to doc description)
                // Don't use trim() - count empty lines too
                if (actualLineCount > 2) {
                    button.style.display = 'block';
                } else {
                    button.style.display = 'none';
                    container.classList.remove('collapsed');
                }
            }
        };

        // Add event listeners
        textarea.addEventListener('input', autoExpand);
        textarea.addEventListener('paste', function() {
            setTimeout(() => autoExpand.call(this), 10);
        });

        // Click to expand when collapsed
        textarea.addEventListener('click', function(e) {
            const container = this.closest('.resource-description-container');
            if (container.classList.contains('collapsed')) {
                // Get cursor position before expanding
                const cursorPos = this.selectionStart;
                const resourceId = container.closest('.resource-item').id;

                // Store cursor position in dataset to use after expansion
                this.dataset.cursorPos = cursorPos;

                toggleResourceDescription(resourceId);
            }
        });

        // Initial sizing
        autoExpand.call(textarea);
    });
}

// Handle resource file upload
function handleResourceFileUpload(resourcePath, fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    console.log('Uploading file to replace resource:', resourcePath, file.name);

    // Set the resource path
    const pathInput = document.getElementById('replace-resource-path');
    if (pathInput) {
        const pathTextarea = pathInput.querySelector('textarea') || pathInput.querySelector('input[type="text"]');
        if (pathTextarea) {
            pathTextarea.value = resourcePath;
            pathTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // Find the hidden file input component and set the file
    const hiddenFileInput = document.querySelector('#replace-resource-file input[type="file"]');
    if (hiddenFileInput) {
        // Create a new DataTransfer to set files on the hidden input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        hiddenFileInput.files = dataTransfer.files;

        // Trigger change event on the hidden file input
        hiddenFileInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Trigger the replace button after a delay
        setTimeout(() => {
            const replaceBtn = document.getElementById('replace-resource-trigger');
            if (replaceBtn) {
                replaceBtn.click();

                // Add visual feedback to the upload zone
                const uploadZone = fileInput.closest('.resource-upload-zone');
                if (uploadZone) {
                    uploadZone.classList.add('upload-success');
                    const uploadText = uploadZone.querySelector('.upload-text');
                    if (uploadText) {
                        uploadText.textContent = '✓ File replaced';
                    }

                    // Reset after 2 seconds
                    setTimeout(() => {
                        uploadZone.classList.remove('upload-success');
                        uploadText.textContent = 'Drop file here to replace';
                    }, 2000);
                }
            }
        }, 100);
    }

    // Clear the file input
    fileInput.value = '';
}

// Prevent drops on resource textareas and inputs
function preventResourceDrops() {
    // Prevent drops on all textareas and inputs within resource items
    const resourceInputs = document.querySelectorAll('.resource-item input, .resource-item textarea');

    resourceInputs.forEach(element => {
        element.addEventListener('dragover', function(e) {
            e.preventDefault();
            if (draggedResource) {
                e.dataTransfer.dropEffect = 'none';
            }
        });

        element.addEventListener('drop', function(e) {
            e.preventDefault();
            if (draggedResource) {
                e.stopPropagation();
                return false;
            }
        });
    });
}

// Function to setup resource upload text
function setupResourceUploadText() {
    // Function to replace the text in resource upload zones
    function replaceResourceUploadText() {
        const resourceUploadZones = document.querySelectorAll('.resource-upload-gradio');

        resourceUploadZones.forEach(zone => {
            // Find all text nodes and remove default Gradio text
            const wrapDivs = zone.querySelectorAll('.wrap');
            wrapDivs.forEach(wrapDiv => {
                // Hide the icon
                const icon = wrapDiv.querySelector('.icon-wrap');
                if (icon) {
                    icon.style.display = 'none';
                }

                // Replace the text content and remove spans with "- or -"
                wrapDiv.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent;
                        if (text.includes('Drop File Here') || text.includes('Click to Upload') || text.includes('- or -')) {
                            node.textContent = '';
                        }
                    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SPAN') {
                        // Check if span contains "- or -" or other unwanted text
                        if (node.textContent.includes('- or -') ||
                            node.textContent.includes('Drop File Here') ||
                            node.textContent.includes('Click to Upload')) {
                            node.style.display = 'none';
                        }
                    }
                });

                // Also hide any .or class spans
                const orSpans = wrapDiv.querySelectorAll('.or, span.or');
                orSpans.forEach(span => {
                    span.style.display = 'none';
                });

                // Add our custom text if not already present
                if (!wrapDiv.querySelector('.custom-upload-text')) {
                    const customText = document.createElement('span');
                    customText.className = 'custom-upload-text';
                    customText.textContent = 'Drop file here to replace';
                    customText.style.fontSize = '11px';
                    customText.style.color = '#666';
                    wrapDiv.appendChild(customText);
                }
            });
        });
    }

    // Try to replace immediately
    replaceResourceUploadText();

    // Watch for changes in resource areas
    const resourcesArea = document.querySelector('.resources-display-area');
    if (resourcesArea) {
        const observer = new MutationObserver((mutations) => {
            replaceResourceUploadText();
        });

        observer.observe(resourcesArea, {
            childList: true,
            subtree: true
        });

        // Stop observing after 10 seconds
        setTimeout(() => observer.disconnect(), 10000);
    }
}

// Setup drag and drop for resource upload zones
function setupResourceUploadZones() {
    const uploadZones = document.querySelectorAll('.resource-upload-zone');

    uploadZones.forEach(zone => {
        let dragCounter = 0;

        zone.addEventListener('dragenter', function(e) {
            e.preventDefault();
            // Only show drag-over effect if NOT dragging a resource
            if (!draggedResource) {
                dragCounter++;
                this.classList.add('drag-over');
            }
        });

        zone.addEventListener('dragover', function(e) {
            e.preventDefault();
            // If dragging a resource, show "not allowed" cursor
            if (draggedResource) {
                e.dataTransfer.dropEffect = 'none';
            } else {
                // For external files, show "copy" cursor
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        zone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                this.classList.remove('drag-over');
            }
        });

        zone.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            this.classList.remove('drag-over');

            // Block resource drops completely
            if (draggedResource) {
                return false;
            }

            // Handle external file drops
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const fileInput = this.querySelector('.resource-file-input');
                const resourcePath = this.getAttribute('data-resource-path');

                if (fileInput && resourcePath) {
                    // Create a new DataTransfer to set files on input
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(e.dataTransfer.files[0]);
                    fileInput.files = dataTransfer.files;

                    // Trigger the change event
                    handleResourceFileUpload(resourcePath, fileInput);
                }
            }
        });
    });
}

// Setup draft tab file upload text monitoring
function setupDraftTabFileUpload() {
    // Function to replace the draft tab text
    function replaceDraftTabText() {
        const draftFileUpload = document.querySelector('.start-file-upload-dropzone');

        if (draftFileUpload) {
            const wrapDivs = draftFileUpload.querySelectorAll('.wrap');
            
            wrapDivs.forEach((wrapDiv, index) => {
                
                if (wrapDiv.textContent.includes('Drop File Here')) {
                    wrapDiv.childNodes.forEach((node, nodeIndex) => {
                        if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('Drop File Here')) {
                            node.textContent = node.textContent.replace('Drop File Here', 'Drop Word or Text File Here');
                        }
                    });
                }
            });
        }
    }

    // Try to replace immediately in case it's already visible
    replaceDraftTabText();

    // Observe the entire document body for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden']
    });

    // Cleanup observer after a reasonable time to avoid memory leaks
    setTimeout(() => {
        observer.disconnect();
    }, 30000); // 30 seconds
}

// Function to remove a resource from the Start tab
function removeStartResourceByIndex(index, resourceName) {
    // Find the hidden inputs for start tab resource removal
    const indexInput = document.getElementById('start-remove-resource-index');
    const nameInput = document.getElementById('start-remove-resource-name');

    if (indexInput && nameInput) {
        // Find the actual input elements (Gradio wraps them)
        const indexTextarea = indexInput.querySelector('textarea') || indexInput.querySelector('input[type="text"]');
        const nameTextarea = nameInput.querySelector('textarea') || nameInput.querySelector('input[type="text"]');

        if (indexTextarea && nameTextarea) {
            // Set the values
            indexTextarea.value = index.toString();
            nameTextarea.value = resourceName;

            // Dispatch input events to trigger Gradio update
            indexTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            nameTextarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Find and click the remove button
            const removeBtn = document.getElementById('start-remove-resource-btn');

            if (removeBtn) {
                removeBtn.click();
            } else {

                // Try to find button by other methods
                const allButtons = document.querySelectorAll('button');

                let foundButton = null;
                allButtons.forEach((btn, idx) => {
                    if (btn.id === 'start-remove-resource-btn') {
                        foundButton = btn;
                    }
                });
                
                if (foundButton) {
                    foundButton.click();
                }
            }
        }
    }
}


// Call setup on initial load
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOMContentLoaded - Starting initialization');

    refresh();
    console.log('Called refresh()');

    setupImportButton();
    console.log('Called setupImportButton()');

    // Upload resource setup no longer needed - using Gradio's native component
    setupExampleSelection();
    console.log('Called setupExampleSelection()');
    setupDownloadDropdown();
    console.log('Called setupDownloadDropdown()');
    
    // Set up observer for workspace collapse button changes
    setupWorkspaceCollapseObserver();
    console.log('Called setupWorkspaceCollapseObserver()');

    // Delay initial drag and drop setup
    setTimeout(() => {
        DragDropLogger.info('INIT', 'Starting delayed setup functions');

        setupDragAndDrop();
        DragDropLogger.info('INIT', 'Called setupDragAndDrop()');

        setupResourceTitleObservers();
        DragDropLogger.info('INIT', 'Called setupResourceTitleObservers()');

        setupResourceUploadZones();
        DragDropLogger.info('INIT', 'Called setupResourceUploadZones()');

        setupResourceUploadText();
        DragDropLogger.info('INIT', 'Called setupResourceUploadText()');

        preventResourceDrops();
        DragDropLogger.info('INIT', 'Called preventResourceDrops()');

        setupHowItWorksHover();
        DragDropLogger.info('INIT', 'Called setupHowItWorksHover()');

        DragDropLogger.success('INIT', 'All initialization complete');
        
        // Start monitoring for drag-drop issues
        startDragDropMonitoring();
    }, 100);
});

// Handle How It Works section hover effects
function setupHowItWorksHover() {
    const steps = document.querySelectorAll('.start-process-step-vertical');
    
    if (steps.length === 3) {
        // Set step 1 as active by default
        steps[0].classList.add('active');
        
        steps.forEach((step, index) => {
            step.addEventListener('mouseenter', () => {
                // Remove active from all steps
                steps.forEach(s => s.classList.remove('active'));
                // Add active to hovered step
                step.classList.add('active');
            });
        });
        
        // When not hovering any step, default to step 1
        const container = document.querySelector('.start-process-steps-vertical');
        if (container) {
            container.addEventListener('mouseleave', () => {
                steps.forEach(s => s.classList.remove('active'));
                steps[0].classList.add('active');
            });
        }
    }
}