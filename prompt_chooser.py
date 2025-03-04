"""
@author: Maxfir3
@title: Prompt Chooser
@nickname: Prompt Chooser
@description: Custom nodes that preview prompts from Florence 2 and pause the workflow to allow the user to edit the prompt
"""

import sys, os
from server import PromptServer
from comfy.model_management import InterruptProcessingException
from aiohttp import web

# Similar message holder class to the Image Chooser
class MessageHolder:
    stash = {}
    messages = {}
    cancelled = False
    
    @classmethod
    def addMessage(cls, id, message):
        if message == '__cancel__':
            cls.messages = {}
            cls.cancelled = True
        elif message == '__start__':
            cls.messages = {}
            cls.stash = {}
            cls.cancelled = False
        else:
            cls.messages[str(id)] = message
    
    @classmethod
    def waitForMessage(cls, id, period=0.1):
        sid = str(id)
        while not (sid in cls.messages) and not ("-1" in cls.messages):
            if cls.cancelled:
                cls.cancelled = False
                raise Cancelled()
            import time
            time.sleep(period)
        if cls.cancelled:
            cls.cancelled = False
            raise Cancelled()
        return cls.messages.pop(str(id), None) or cls.messages.pop("-1")

class Cancelled(Exception):
    pass

# Set up the API route for handling prompt editing messages
routes = PromptServer.instance.routes
@routes.post('/prompt_chooser_message')
async def make_prompt_selection(request):
    post = await request.post()
    MessageHolder.addMessage(post.get("id"), post.get("message"))
    return web.json_response({})

# Prompt Chooser Node
class PromptChooser:
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "func"
    CATEGORY = "prompt_chooser"
    OUTPUT_NODE = False
    
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "prompt": ("STRING", {"multiline": True}),
                "mode": (["Always pause", "Pass through"], {}),
            },
            "hidden": {"prompt_info": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "id": "UNIQUE_ID"},
        }
    
    @classmethod
    def IS_CHANGED(cls, id, **kwargs):
        # Generate a new random value each time to ensure it runs every time
        import random
        return random.random()
    
    def func(self, id, **kwargs):
        mode = kwargs.pop('mode', "Always pause")
        prompt = kwargs.pop('prompt', "")
        id = id[0]
        
        if id not in MessageHolder.stash:
            MessageHolder.stash[id] = {}
        my_stash = MessageHolder.stash[id]
        
        # Store the prompt for later use
        my_stash['prompt'] = prompt
        
        # If mode is Pass through, just return the prompt
        if mode == "Pass through":
            return (prompt,)
        
        # Send the prompt to the frontend for editing
        PromptServer.instance.send_sync("prompt-edit-handler", {"id": id, "prompt": prompt})
        
        # Wait for user to edit and submit the prompt
        try:
            edited_prompt = MessageHolder.waitForMessage(id)
        except Cancelled:
            raise InterruptProcessingException()
        
        # Return the edited prompt
        return (edited_prompt,)

# Florence 2 Prompt Intercept Node
class Florence2PromptInterceptor:
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "func"
    CATEGORY = "prompt_chooser"
    OUTPUT_NODE = False
    
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "florence_output": ("STRING", {"multiline": True}),
                "mode": (["Always pause", "Pass through"], {}),
            },
            "hidden": {"prompt_info": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "id": "UNIQUE_ID"},
        }
    
    @classmethod
    def IS_CHANGED(cls, id, **kwargs):
        # Generate a new random value each time to ensure it runs every time
        import random
        return random.random()
    
    def func(self, id, **kwargs):
        mode = kwargs.pop('mode', "Always pause")
        florence_output = kwargs.pop('florence_output', "")
        id = id[0]
        
        if id not in MessageHolder.stash:
            MessageHolder.stash[id] = {}
        my_stash = MessageHolder.stash[id]
        
        # Store the prompt for later use
        my_stash['prompt'] = florence_output
        
        # If mode is Pass through, just return the prompt
        if mode == "Pass through":
            return (florence_output,)
        
        # Send the prompt to the frontend for editing
        PromptServer.instance.send_sync("prompt-edit-handler", {"id": id, "prompt": florence_output})
        
        # Wait for user to edit and submit the prompt
        try:
            edited_prompt = MessageHolder.waitForMessage(id)
        except Cancelled:
            raise InterruptProcessingException()
        
        # Return the edited prompt
        return (edited_prompt,)