import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// Flow state management
class FlowState {
    static idle() {
        return (!app.runningNodeId);
    }
    
    static paused() {
        return (app.runningNodeId && app.graph._nodes_by_id[app.runningNodeId].isPromptChooser);
    }
    
    static paused_here(node_id) {
        return (FlowState.paused() && app.runningNodeId == node_id);
    }
    
    static running() {
        return (!FlowState.idle());
    }
    
    static here(node_id) {
        return (app.runningNodeId == node_id);
    }
    
    static state() {
        if (FlowState.paused()) return "Paused";
        if (FlowState.running()) return "Running";
        return "Idle";
    }
    
    static cancelling = false;
}

// Utility functions for sending messages
function send_message(id, message) {
    const body = new FormData();
    body.append('message', message);
    body.append('id', id);
    api.fetchApi("/prompt_chooser_message", { method: "POST", body });
}

function send_cancel() {
    send_message(-1, '__cancel__');
}

function send_onstart() {
    send_message(-1, '__start__');
    return true;
}

// Create a modal dialog for prompt editing
function createPromptEditDialog(id, prompt) {
    // Remove any existing dialogs
    const existingDialog = document.getElementById("prompt-edit-dialog");
    if (existingDialog) {
        existingDialog.remove();
    }
    
    // Create dialog elements
    const dialog = document.createElement("div");
    dialog.id = "prompt-edit-dialog";
    dialog.style.position = "fixed";
    dialog.style.top = "50%";
    dialog.style.left = "50%";
    dialog.style.transform = "translate(-50%, -50%)";
    dialog.style.backgroundColor = "#1a1a1a";
    dialog.style.padding = "20px";
    dialog.style.borderRadius = "8px";
    dialog.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.5)";
    dialog.style.zIndex = "1000";
    dialog.style.minWidth = "600px";
    dialog.style.maxWidth = "80%";
    dialog.style.display = "flex";
    dialog.style.flexDirection = "column";
    dialog.style.gap = "15px";
    
    // Title
    const title = document.createElement("h2");
    title.textContent = "Edit Prompt";
    title.style.margin = "0";
    title.style.color = "#fff";
    
    // Textarea for prompt editing
    const textarea = document.createElement("textarea");
    textarea.value = prompt;
    textarea.style.width = "100%";
    textarea.style.minHeight = "200px";
    textarea.style.padding = "10px";
    textarea.style.backgroundColor = "#2a2a2a";
    textarea.style.color = "#fff";
    textarea.style.border = "1px solid #444";
    textarea.style.borderRadius = "4px";
    textarea.style.resize = "vertical";
    textarea.style.fontFamily = "monospace";
    
    // Button container
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "10px";
    
    // Cancel button
    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancel";
    cancelButton.style.padding = "8px 16px";
    cancelButton.style.backgroundColor = "#555";
    cancelButton.style.color = "#fff";
    cancelButton.style.border = "none";
    cancelButton.style.borderRadius = "4px";
    cancelButton.style.cursor = "pointer";
    cancelButton.onclick = function() {
        dialog.remove();
        send_cancel();
    };
    
    // Submit button
    const submitButton = document.createElement("button");
    submitButton.textContent = "Submit";
    submitButton.style.padding = "8px 16px";
    submitButton.style.backgroundColor = "#3f8fff";
    submitButton.style.color = "#fff";
    submitButton.style.border = "none";
    submitButton.style.borderRadius = "4px";
    submitButton.style.cursor = "pointer";
    submitButton.onclick = function() {
        const editedPrompt = textarea.value;
        dialog.remove();
        send_message(id, editedPrompt);
    };
    
    // Add elements to the dialog
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(submitButton);
    dialog.appendChild(title);
    dialog.appendChild(textarea);
    dialog.appendChild(buttonContainer);
    
    // Add dialog to the document
    document.body.appendChild(dialog);
}

// Register the extension
app.registerExtension({
    name: "custom.prompt_chooser",
    
    init() {
        window.addEventListener("beforeunload", send_cancel, true);
    },
    
    async nodeCreated(node) {
        if (node?.comfyClass === "Prompt Chooser" || node?.comfyClass === "Florence2 Prompt Interceptor") {
            node.isPromptChooser = true;
            
            // Add buttons for the node
            node.cancel_button_widget = node.addWidget("button", "", "", () => {
                if (FlowState.running()) {
                    send_cancel();
                }
            });
            
            node.send_button_widget = node.addWidget("button", "", "", () => {
                if (FlowState.paused_here(node.id)) {
                    // This will be handled by the dialog's submit button
                }
            });
            
            // Make the buttons not serializable
            node.cancel_button_widget.options = node.cancel_button_widget.options || {};
            node.cancel_button_widget.options.serialize = false;
            node.send_button_widget.options = node.send_button_widget.options || {};
            node.send_button_widget.options.serialize = false;
            
            // Update function to handle button states
            const update = node.onDrawBackground;
            node.onDrawBackground = function(ctx) {
                if (update) update.apply(this, arguments);
                
                // Update button states
                if (this.cancel_button_widget) {
                    this.cancel_button_widget.name = FlowState.running() ? "Cancel current run" : "";
                }
                
                if (this.send_button_widget) {
                    this.send_button_widget.name = FlowState.paused_here(this.id) ? "Submit edited prompt" : "";
                }
                
                this.setDirtyCanvas(true, true);
            }
        }
    },
    
    setup() {
        // At the start of execution
        api.addEventListener("execution_start", () => {
            send_onstart();
        });
        
        // Handle prompt editing
        api.addEventListener("prompt-edit-handler", (event) => {
            createPromptEditDialog(event.detail.id, event.detail.prompt);
        });
        
        // Add settings
        app.ui.settings.addSetting({
            id: "PromptChooser.alert",
            name: "Prompt Chooser: enable alert sound",
            type: "boolean",
            defaultValue: true,
        });
        
        // If a run is interrupted, send a cancel message
        const original_api_interrupt = api.interrupt;
        api.interrupt = function () {
            if (FlowState.paused() && !FlowState.cancelling) {
                send_cancel();
            }
            original_api_interrupt.apply(this, arguments);
        }
    }
});