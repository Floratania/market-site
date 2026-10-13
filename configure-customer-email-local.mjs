import path from 'node:path';
import {spawn} from 'node:child_process';
const docker=path.join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe');
const script=`from django.db import transaction
from saleor.channel.models import Channel
from saleor.plugins.models import PluginConfiguration,EmailTemplate
identifier='mirumee.notifications.user_email'
source=PluginConfiguration.objects.get(identifier=identifier,channel__slug='default-channel')
config={field['name']:field['value'] for field in source.configuration}
assert source.active and config.get('host')=='mailpit' and int(config.get('port'))==1025
with transaction.atomic():
 plugin,created=PluginConfiguration.objects.get_or_create(identifier=identifier,channel=Channel.objects.get(slug='vs-market-ua'),defaults={'active':True,'configuration':source.configuration})
 if created:
  for template in EmailTemplate.objects.filter(plugin_configuration=source):
   EmailTemplate.objects.create(plugin_configuration=plugin,name=template.name,value=template.value)
 else:
  target={field['name']:field['value'] for field in plugin.configuration}
  assert plugin.active and target.get('host')=='mailpit' and int(target.get('port'))==1025
print('VS Market local email plugin configured' if created else 'VS Market local email plugin already configured')
`;
const child=spawn(docker,['compose','-p','vsmarket-local','-f','saleor-platform/docker-compose.yml','exec','-T','api','python3','manage.py','shell','-c',script],{cwd:new URL('./',import.meta.url),stdio:'inherit',windowsHide:true,env:{...process.env,PATH:path.dirname(docker)+path.delimiter+process.env.PATH}});
child.on('error',()=>{console.error('Local email plugin setup unavailable');process.exitCode=1;});
child.on('exit',code=>process.exitCode=code||0);
