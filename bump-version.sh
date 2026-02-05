#!/usr/bin/env bash

set -e

MANIFEST_FILE="src/manifest.json"
MANIFEST_CHROME_FILE="src/manifest-chrome.json"

# Get current version from latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
CURRENT_VERSION=${LATEST_TAG#v}

echo "Latest tag: $LATEST_TAG"
echo "Current version: $CURRENT_VERSION"

# Get commits since last tag
COMMITS=$(git log "$LATEST_TAG"..HEAD --pretty=format:"%s" 2>/dev/null || git log --pretty=format:"%s")

if [ -z "$COMMITS" ]; then
  echo "No commits since last tag. Nothing to bump."
  exit 0
fi

echo ""
echo "Commits since $LATEST_TAG:"
echo "$COMMITS"
echo ""

# Determine bump type based on conventional commits
BUMP_TYPE="patch"

# Check for breaking changes (major bump)
if echo "$COMMITS" | grep -qE "^[a-z]+(\(.+\))?!:|BREAKING CHANGE"; then
  BUMP_TYPE="major"
# Check for features (minor bump)
elif echo "$COMMITS" | grep -qE "^feat(\(.+\))?:"; then
  BUMP_TYPE="minor"
# Everything else is patch (fix, chore, docs, etc.)
fi

echo "Determined bump type: $BUMP_TYPE"

# Parse current version
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

# Calculate new version
case $BUMP_TYPE in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

echo ""
echo "Version bump summary:"
echo "  Current version: $CURRENT_VERSION"
echo "  New version:     $NEW_VERSION"
echo "  Bump type:       $BUMP_TYPE"
echo ""
read -p "Proceed with version bump? [Y/n] " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Update version in manifest files (works on both macOS and Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST_FILE"
  sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST_CHROME_FILE"
else
  sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST_FILE"
  sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST_CHROME_FILE"
fi

echo "Updated $MANIFEST_FILE"
echo "Updated $MANIFEST_CHROME_FILE"

# Commit the change
git add "$MANIFEST_FILE" "$MANIFEST_CHROME_FILE"
git commit -m "chore: bump version to $NEW_VERSION"

# Create annotated tag
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo "Created tag v$NEW_VERSION"

echo ""
read -p "Push commit and tag to origin? [Y/n] " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
  echo "Skipped pushing."
else
  git push origin main
  git push origin "v$NEW_VERSION"
  echo "Pushed commit and tag to origin."
fi
