# Janeway Immunobiology Web Book

장별 HTML 파일을 하나의 책처럼 탐색할 수 있도록 구성한 개인 학습용 리더입니다.

## 구성 파일

| 파일 | 성격 | 설명 |
|---|---|---|
| `chN.html`, `chN-exercises.html` | 자동 생성 | 각 장의 본문 리더와 연습문제. 자체 팔레트를 인라인 `<style>`로 갖는 독립 페이지 |
| `book.js` | **자동 생성** | 목차 데이터(`window.BOOK_PAGES`)만 담는다. 직접 수정하지 말 것 |
| `book-nav.js` | 수동 관리 · **소스** | 목차·사이드바·이전/다음 동작 |
| `book.css` | 수동 관리 · **소스** | 홈 화면 스타일 + 탐색 UI 스타일 |
| `index.html` | 수동 관리 | 전체 목차 홈 |
| `scripts/build_book.py` | 수동 관리 | 장 HTML을 읽어 `book.js`를 생성 |
| `scripts/apply_nav.py` | 수동 관리 | 위 세 파일을 각 HTML 안에 인라인으로 심는다 |

### 왜 인라인인가

각 장 HTML은 그림까지 data URI로 품은 **자기완결 파일**이다. 서버 없이 파일을 그냥 열어도, 다른 폴더로 복사해도, 한 장만 따로 옮겨도 그대로 동작해야 한다. 탐색 레이어를 `<link>`/`<script src>`로 걸면 그 전제가 깨져서 — 형제 파일이 함께 있지 않으면 사이드바와 이전/다음이 조용히 사라진다.

그래서 `book.css`와 `book-nav.js`는 **편집용 소스**로 두고, `apply_nav.py`가 그 내용과 생성된 목차를 각 HTML의 `<!--BOOK-NAV-START-->` ~ `<!--BOOK-NAV-END-->` 사이에 복사해 넣는다. 여러 번 실행해도 블록을 새로 쌓지 않고 교체한다.

## 탐색 기능

- **홈(`index.html`)** — Part별로 묶인 장 목록. 소절 목차는 **기본적으로 접혀 있고** 카드마다 펼침 버튼이 있다. 상단의 「소절 모두 펼치기」로 한 번에 열 수 있다. 테마 토글은 선택을 `localStorage`에 기억한다.
- **각 장** — 헤더의 책 아이콘으로 전체 장 목록 사이드바가 열린다. 현재 장은 강조되고 그 장의 소절만 펼쳐진 채 시작하며, 다른 장은 화살표로 개별 확장한다. `Esc`로 닫힌다.
- **각 장 하단** — 이전 / 다음 페이지 버튼. 순서는 `ch1 → ch2 → ch2 연습문제 → ch3 …` 이며, 양 끝에서는 전체 목차 홈으로 연결된다.

### 색상 처리

각 장은 자기 팔레트를 `--paper`, `--ink`, `--accent` 같은 CSS 변수로 정의한다. `book.css`의 탐색 UI는 그 변수만 참조하므로 사이드바·이전/다음 버튼이 **그 장의 색과 라이트/다크 상태를 그대로 따라간다**. 홈 전용 팔레트(`--bk-*`)는 `.book-home`에만 매핑되어 장의 팔레트를 건드리지 않는다.

## 새 챕터 추가

1. `chN.html`(필요하면 `chN-exercises.html`)을 루트에 넣는다.
2. 아래 두 줄을 실행한다. 탐색 레이어는 자동으로 모든 장에 심어진다.

```bash
python scripts/build_book.py && python scripts/apply_nav.py
```

`book.css`나 `book-nav.js`를 고친 뒤에도 `apply_nav.py`를 다시 실행해야 각 장에 반영된다.

`build_book.py`는 각 장의 `<title>`, `.parttag`/`.kicker`, `<h2>`~`<h4>`를 읽는다. id가 없는 소제목에는 결정적 슬러그를 부여하고 원본 파일에 그 id를 기록해 링크가 계속 유효하도록 한다. Part 표기가 장마다 조금씩 다른 경우(`Part IV · adaptive immune response` vs `Part IV · 적응 면역 반응`)는 `book-nav.js`가 로마자 번호 기준으로 하나의 Part로 묶는다.

## 공개 배포에 대하여

`.github/workflows/update-book.yml`은 push 시 `book.js`를 자동 재생성하도록 되어 있습니다. 이 리더는 개인 소장용이며, 저장소를 public으로 두면 번역 본문이 그대로 공개됩니다. 비공개로 유지하려면 저장소를 private으로 두거나 해당 워크플로를 제거하세요.
