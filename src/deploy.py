"""
Pack everything up and deploy it to S3.
"""

import app
from jinja2 import Template
from s3 import deploy_to_bucket
import shutil
import os

with open('templates/layout.html', 'r') as f:
    content = f.read()

with open('VERSION', 'r') as f:
    version = f.read()

template = Template(content)

data = app.inject_assets()
data['version'] = input("Version number (last was {}): ".format(version))
data['environment'] = 'prod'

with open('VERSION', 'w') as f:
    f.write(data['version'])

out = template.render(data)

path = "/Users/m/litany_builds/v"+data['version']+'/'

if not os.path.isdir(path):
    os.makedirs (path)

shutil.copytree('assets', path+'assets')

with open(path+'index.html', 'w') as f:
    f.write(out)


deploy_to_bucket(path, 'dialog.litany.io')
