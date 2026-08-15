# Janeway Immunobiology Web Book

이 repository는 장별 HTML 파일을 하나의 책처럼 탐색할 수 있도록 구성되어 있습니다.

## 자동 챕터 등록

새 챕터를 `ch3.html`, `ch4.html`처럼 repository 루트에 추가하고 push하면 됩니다. `.github/workflows/update-book.yml`이 실행되어 `scripts/build_book.py`가 다음 정보를 자동으로 읽습니다.

- `<title>` → 챕터 제목
- `.parttag` 또는 `.kicker` → Part/section
- `<h2>`, `<h3>`, `<h4>` → 소절 목차
- 기존 `id` → 소절 링크 주소

`book.js`는 자동 생성되므로 직접 수정할 필요가 없습니다.

## GitHub Pages

`Settings → Pages → Deploy from a branch → main / (root)`로 설정합니다.

## 챕터 파일 규칙

권장 파일명은 `ch1.html`, `ch2.html`, `ch3.html` 형식입니다. `ch2-exercises.html`처럼 장 번호 뒤에 suffix가 붙은 페이지는 해당 장의 보조 페이지로 인식하고 같은 장 번호 뒤에 배치합니다.
