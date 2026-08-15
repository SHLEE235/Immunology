# Janeway Immunobiology Web Book

이 repository는 장별 HTML 파일을 하나의 책처럼 탐색할 수 있도록 구성되어 있습니다.

## 자동 챕터 등록

새 챕터를 `ch3.html`, `ch4.html`처럼 repository 루트에 추가하고 push하면 됩니다. `.github/workflows/update-book.yml`이 실행되어 `scripts/build_book.py`가 다음 정보를 자동으로 읽습니다.

- `<title>` → 챕터 제목
- `.parttag` 또는 `.kicker` → Part/section
- `<h2>`, `<h3>`, `<h4>` → 소절 목차
- 기존 `id` → 소절 링크 주소

빌드 스크립트는 각 챕터 파일에 `book.css`/`book.js` 링크도 자동으로 삽입합니다.

`book.js`는 `scripts/book_runtime.js`(탐색 동작)와 자동 추출한 목차 데이터를 합쳐 생성되므로 직접 수정하지 않습니다. 탐색 동작을 바꾸려면 `scripts/book_runtime.js`를, 스타일은 `book.css`를 수정하세요.

## 페이지 탐색 기능

챕터·연습문제 페이지에서 사용할 수 있습니다.

- **왼쪽 사이드바 목차**: 상단 바의 `☰ 목차` 버튼으로 열고 닫습니다. 전체 장과 소절을 담고 있으며, 항목을 누르면 해당 위치로 이동합니다. 검색창으로 목차를 걸러 볼 수 있고, 화면 폭이 1200px 이상이면 본문 옆에 고정되어 열린 상태가 유지됩니다(열고 닫은 상태는 브라우저에 저장됩니다). 좁은 화면에서는 오버레이로 열리며 바깥쪽·`Esc`·`×`로 닫습니다.
- **이전/다음 이동**: 본문 아래 이전/다음 카드, 상단 바의 화살표 버튼, 그리고 `[`·`]` 또는 `Alt+←`·`Alt+→` 단축키로 앞뒤 페이지(연습문제 포함)를 오갈 수 있습니다.
- 현재 읽고 있는 소절은 사이드바에서 자동으로 강조됩니다.

## GitHub Pages

`Settings → Pages → Deploy from a branch → main / (root)`로 설정합니다.

## 챕터 파일 규칙

권장 파일명은 `ch1.html`, `ch2.html`, `ch3.html` 형식입니다. `ch2-exercises.html`처럼 장 번호 뒤에 suffix가 붙은 페이지는 해당 장의 보조 페이지로 인식하고 같은 장 번호 뒤에 배치합니다.
