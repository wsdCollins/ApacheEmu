# ApacheEmu
An emulator for the Apache front server for Aptana Jaxer written with Nodejs and Express

## Install

``` git clone https://github.com/wsdCollins/ApacheEmu.git
cd ApacheEmu
npm install
npm install pm2 -g
pm2 start index.js
```

And then to run on start up (if needed)
```
pm2 startup
pm2 save
```
