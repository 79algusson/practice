@echo off
echo === 과학교육 논문 검색 어시스턴트 빌드 시작 ===

echo [1/3] 패키지 설치 확인 중...
pip install --quiet anthropic reportlab openpyxl pyinstaller

echo [2/3] PyInstaller로 빌드 중...
pyinstaller paper_search.spec --clean --noconfirm

echo [3/3] 완료!
echo.
echo ✅ 실행 파일 위치: dist\논문검색어시스턴트.exe
pause
