import path from 'node:path';
import {spawn} from 'node:child_process';
const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
const script=`from django.conf import settings
from saleor.plugins.models import PluginConfiguration
from saleor.site.models import SiteSettings
import json
import os
from urllib.parse import urlparse
site=SiteSettings.objects.first()
print(json.dumps({'smtpHost':settings.EMAIL_HOST,'smtpPort':settings.EMAIL_PORT,'emailUrlHost':urlparse(os.environ.get('EMAIL_URL','')).hostname,'requireConfirmation':site.enable_account_confirmation_by_email,'allowLoginWithoutConfirmation':site.allow_login_without_confirmation,'plugins':[{'identifier':p.identifier,'active':p.active,'channel':p.channel.slug if p.channel else None,'deliveryFields':[{key:field.get(key) for key in ['name','value']} for field in p.configuration if field.get('name') in ['host','port','smtp_host','smtp_port','use_tls','use_ssl']],'templateFields':[{'name':field.get('name'),'length':len(field.get('value') or '')} for field in p.configuration if 'confirmation' in field.get('name','') or 'password_reset' in field.get('name','')]} for p in PluginConfiguration.objects.all()]}))
`;
const child=spawn(docker,['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','api','python3','manage.py','shell','-c',script],{cwd:new URL('./',import.meta.url),stdio:'inherit',windowsHide:true,env:{...process.env,PATH:path.dirname(docker)+path.delimiter+process.env.PATH}});
child.on('error',()=>{console.error('Cannot verify local email configuration');process.exitCode=1;});
child.on('exit',code=>process.exitCode=code||0);
