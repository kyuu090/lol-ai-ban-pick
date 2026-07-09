#!/bin/bash

RELEASE_HOST=$1
VERSION=$2

scp dist/BanPick-ai-${VERSION}-setup.exe root@${RELEASE_HOST}:/opt/lol-ai-ban-pick/updates/app/BanPick-ai-${VERSION}-setup.exe
scp dist/BanPick-ai-${VERSION}-setup.exe.blockmap root@${RELEASE_HOST}:/opt/lol-ai-ban-pick/updates/app/BanPick-ai-${VERSION}-setup.exe.blockmap
scp dist/latest.yml root@${RELEASE_HOST}:/opt/lol-ai-ban-pick/updates/app/latest.yml
