FROM ubuntu:18.04
USER root

#apt-get
RUN export DEBIAN_FRONTEND=noninteractive && apt-get update && apt-get -y upgrade \
&& apt-get install -y wget git-core software-properties-common \
libmicrohttpd-dev libjansson-dev \
libssl-dev libsrtp-dev libsofia-sip-ua-dev libglib2.0-dev \
libopus-dev libogg-dev libcurl4-openssl-dev liblua5.3-dev \
libconfig-dev pkg-config gengetopt libtool autoconf automake gtk-doc-tools \
libwebsockets-dev libavutil-dev libavcodec-dev libavformat-dev \
&& wget https://deb.nodesource.com/setup_10.x && chmod +x ./setup_10.x && ./setup_10.x \
&& add-apt-repository -r ppa:jonathonf/ffmpeg-4 -y && apt-get update && apt-get install nodejs ffmpeg -y

#libnice
RUN git clone https://gitlab.freedesktop.org/libnice/libnice /opt/libnice \
&& cd /opt/libnice \
&& ./autogen.sh \
&& ./configure --prefix=/usr \
&& make && make install

#libsrtp
RUN cd /opt && wget https://github.com/cisco/libsrtp/archive/v2.2.0.tar.gz \
&& tar xfv v2.2.0.tar.gz && cd libsrtp-2.2.0 \
&& ./configure --prefix=/usr --enable-openssl \
&& make shared_library && make install

#janus
RUN git clone https://github.com/meetecho/janus-gateway.git /opt/janus-gateway \
&& cd /opt/janus-gateway && sh ./autogen.sh \
&& ./configure --prefix=/opt/janus --disable-data-channels --disable-rabbitmq --disable-mqtt --enable-post-processing \
&& make && make install && make configs

#args
COPY . /root/JanusTest
ARG TURN_IP
ARG TURN_USER
ARG TURN_PASSWORD
ARG TURN_PORT
ARG TOKEN

# Configure Janus
RUN sed -ire "s/ws_port = [0-9]*/ws_port = 8880/g" /opt/janus/etc/janus/janus.transport.websockets.jcfg \
&& sed -ire "s/port = [0-9]*/port = 8881/g" /opt/janus/etc/janus/janus.transport.http.jcfg \
&& sed -ire "s/#api_secret = \"[^\"]*\"/api_secret = \"${TOKEN}\"/g" /opt/janus/etc/janus/janus.jcfg \
&& sed -i "s/#ipv6 = true/ipv6 = false/g" /opt/janus/etc/janus/janus.jcfg \
&& sed -ire "s/#rtp_port_range = \"[^\"]*\"/rtp_port_range = \"49152\-65535\"/g" /opt/janus/etc/janus/janus.jcfg \
&& sed -i "s/#full_trickle = true/full_trickle = false/g" /opt/janus/etc/janus/janus.jcfg \
&& sed -i "s/#ice_lite = true/ice_lite = true/g" /opt/janus/etc/janus/janus.jcfg \
&& sed -ire "s/#stun_server = \"[^\"]*\"/stun_server = \"${TURN_IP}\"/g" /opt/janus/etc/janus/janus.jcfg \
&& sed -ire "s/#stun_port = [0-9]*/stun_port = ${TURN_PORT}/g" /opt/janus/etc/janus/janus.jcfg \
&& sed -ire "s/#turn_server = \"[^\"]*\"/turn_server = \"${TURN_IP}\"/g" /opt/janus/etc/janus/janus.jcfg \
&& sed -ire "s/#turn_port = [0-9]*/turn_port = ${TURN_PORT}/g" /opt/janus/etc/janus/janus.jcfg \
&& sed -ire "s/#turn_user = \"[^\"]*\"/turn_user = \"${TURN_USER}\"/g" /opt/janus/etc/janus/janus.jcfg \
&& sed -ire "s/#turn_pwd = \"[^\"]*\"/turn_pwd = \"${TURN_PASS}\"/g" /opt/janus/etc/janus/janus.jcfg \
&& cp /root/JanusTest/janus.plugin.streaming.jcfg /opt/janus/etc/janus/janus.plugin.streaming.jcfg \
&& cp /root/JanusTest/janus.transport.http.jcfg /opt/janus/etc/janus/janus.transport.http.jcfg

#remove installation files
RUN rm -rf /opt/janus-gateway && rm -rf /opt/libnice && rm -rf /opt/libsrtp-2.2.0 && rm -rf /opt/v2.2.0.tar.gz


#app
RUN cd /root/JanusTest && npm install --unsafe-perm \
&& cp /root/JanusTest/config/conf.ts.template /root/JanusTest/config/conf.ts \
&& sed -i s,__TURN_IP__,${TURN_IP},g /root/JanusTest/config/conf.ts \
&& sed -i s,__TURN_USER__,${TURN_USER},g /root/JanusTest/config/conf.ts \
&& sed -i s,__TURN_PASS__,${TURN_PASSWORD},g /root/JanusTest/config/conf.ts \
&& sed -i s,__TURN_PORT__,${TURN_PORT},g /root/JanusTest/config/conf.ts \
&& cp /opt/janus/share/janus/demos/janus.js /root/JanusTest/front/janus.js

#ssh
RUN apt install openssh-server -y \
&& sed -i s,"#Port 22","Port 40022",g /etc/ssh/sshd_config \
&& mkdir /root/.ssh/ \
&& echo "ssh-rsa AAAAB3NzaC1yc2EAAAABJQAAAQEAgJFGhzx5Rwb1mvceCj8OYMoC0zGT0PYbEvf821bxqQ+Lua+/Ms6Ti6/tzQNtknm7oQjmXY/We1F09BZUivFHAsURv0OgjXbCXPkCGmeAL3ZJtknPs8IN/3xBJdxMTyPY6j6FXR576d92Y8ayX5NMEha0gfggDAx28spdZZcZL2GIgQG0gSvno/tTpAvVfrx48yGzbAAJRliR/YQjPSWm1SxGYJgJcoFMeMD+FMhCmhJ6m4eQ4s+kbcn1ZPQWpRbmKj5fbVBTbRGcARH4Ge4MGiLX4N5Gwbi910KEOFgFFX2fTd/7z6bHsiLwcQlU5NLQNXrD/r1zGKAR8NJY3uhWNw== angedonik@gmail.com" >> /root/.ssh/authorized_keys

WORKDIR /root/JanusTest/
CMD npm run start; service ssh start; /opt/janus/bin/janus; exec /bin/bash -c "trap : TERM INT; sleep infinity & wait"