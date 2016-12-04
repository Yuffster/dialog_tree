"""
Pack everything up and deploy it to S3.
"""

import app
from jinja2 import Template
from s3 import deploy_to_bucket
import shutil

with open('templates/layout.html', 'r') as f:
    content = f.read()

with open('VERSION', 'wr') as f:
	version = f.read()

template = Template(content)

data = app.inject_assets()
data['version'] = 1.2.7
data['environment'] = 'prod'

out = template.render(data)
out = out.replace('  ', '')
out = out.replace('\t', '');
out = out.replace('\n\n', '');

path = "/Users/m/testzip/"

try:
	shutil.rmtree(path+'assets')
except FileNotFoundError:
	pass

shutil.copytree('assets', path+'assets')

with open(path+'index.html', 'w') as f:
    f.write(out)


deploy_to_bucket(path, 'dialog.litany.io')