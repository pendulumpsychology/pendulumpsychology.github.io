git pull
git add .
git commit -a -m "commit"
git push
call "%~dp0istdp-supervision\roster-server\deploy.bat" nopause
(PAUSE)
