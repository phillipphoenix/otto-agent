#!/bin/sh
set -eu

REPO="phillipphoenix/otto-agent"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${VERSION:-latest}"

# Detect platform
OS="$(uname -s)"
case "$OS" in
  Linux*)  os="linux" ;;
  Darwin*) os="darwin" ;;
  *)       echo "Unsupported OS: $OS"; exit 1 ;;
esac

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  arch="x64" ;;
  aarch64|arm64) arch="arm64" ;;
  *)       echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Resolve version
if [ "$VERSION" = "latest" ]; then
  VERSION="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name"' | cut -d'"' -f4)"
  if [ -z "$VERSION" ]; then
    echo "Failed to fetch latest version"; exit 1
  fi
fi

ARTIFACT="otto-${os}-${arch}"
URL="https://github.com/$REPO/releases/download/$VERSION/$ARTIFACT"

echo "Installing otto $VERSION ($os/$arch)..."

# Download
mkdir -p "$INSTALL_DIR"
curl -fsSL "$URL" -o "$INSTALL_DIR/otto"
chmod +x "$INSTALL_DIR/otto"

# PATH setup
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    SHELL_NAME="$(basename "$SHELL")"
    case "$SHELL_NAME" in
      zsh)  RC_FILE="$HOME/.zshrc" ;;
      bash) RC_FILE="$HOME/.bashrc" ;;
      *)    RC_FILE="$HOME/.profile" ;;
    esac
    echo "" >> "$RC_FILE"
    echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$RC_FILE"
    echo "Added $INSTALL_DIR to PATH in $RC_FILE"
    echo "Run 'source $RC_FILE' or restart your terminal to use otto."
    ;;
esac

echo "Installed otto $VERSION to $INSTALL_DIR/otto"
