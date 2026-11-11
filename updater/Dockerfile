FROM docker:cli
RUN apk add --no-cache git openssh-client
COPY update.sh /update.sh
RUN sed -i 's/\r$//' /update.sh && chmod +x /update.sh
CMD ["/update.sh"]
