FROM debian:stable-slim

# Why Debian instead of Alpine?
# cursor-agent uses a bundled Node.js binary that requires glibc and C++ standard libraries.
# Alpine Linux uses musl libc instead of glibc, which causes compatibility issues with the
# pre-compiled Node.js binary. Debian provides the necessary glibc (libc.so.6) and C++ standard
# library (libstdc++.so.6), ensuring the bundled Node.js binary runs correctly.

# Install dependencies and Cursor CLI, then clean up to minimize size
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    curl https://cursor.com/install -fsS | bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /usr/share/doc/* /usr/share/man/*

# Add ~/.local/bin to PATH
ENV PATH="/root/.local/bin:${PATH}"

# Set cursor-agent as entrypoint to pass args through
ENTRYPOINT ["cursor-agent"]

# Accept CURSOR_API_KEY as environment variable
# Usage: docker run -e CURSOR_API_KEY=your_key image-name <cursor-agent-args>

