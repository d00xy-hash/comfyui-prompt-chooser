"""
@author: Maxfir3
@title: Prompt Chooser
@nickname: Prompt Chooser
@description: Custom nodes that preview prompts and pause the workflow to allow the user to edit them before continuing
"""

import sys, os

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from prompt_chooser import PromptChooser, Florence2PromptInterceptor, MessageHolder

module_root_directory = os.path.dirname(os.path.realpath(__file__))
module_js_directory = os.path.join(module_root_directory, "js")

NODE_CLASS_MAPPINGS = { 
    "Prompt Chooser": PromptChooser,
    "Florence2 Prompt Interceptor": Florence2PromptInterceptor,
}

WEB_DIRECTORY = "./js"
__all__ = ["NODE_CLASS_MAPPINGS", "WEB_DIRECTORY"]

PC_VERSION = "1.0.0"