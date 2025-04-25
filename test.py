from openvino.runtime import Core

# Initialize OpenVINO runtime
core = Core()

# Print available devices
devices = core.available_devices
print("Available devices:", devices)