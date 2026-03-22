#!/bin/bash
# Build script for 논문검색어시스턴트
# Run this from the paper_search directory

set -e

echo "=== 과학교육 논문 검색 어시스턴트 빌드 시작 ==="

# Check dependencies
echo "[1/3] 패키지 확인 중..."
pip install --quiet anthropic reportlab openpyxl pyinstaller

# Build
echo "[2/3] PyInstaller로 빌드 중..."
pyinstaller paper_search.spec --clean --noconfirm

echo "[3/3] 완료!"
echo ""
if [ -f "dist/논문검색어시스턴트" ]; then
    echo "✅ Linux 실행 파일: dist/논문검색어시스턴트"
elif [ -f "dist/논문검색어시스턴트.exe" ]; then
    echo "✅ Windows 실행 파일: dist/논문검색어시스턴트.exe"
fi
echo ""
echo "※ Windows .exe를 만들려면 Windows 환경에서 이 스크립트를 실행하세요."
echo "  또는 Wine + PyInstaller 조합을 사용하세요."
