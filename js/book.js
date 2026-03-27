// ==========================
// 1) 공통: Kakao 책 검색
// ==========================
const KAKAO_REST_KEY = "edc2045d293aaefae2c494a92245c19a";

async function fetchBooks(query, size = 17) {
  const params = new URLSearchParams({
    target: "title",
    query,
    size: String(size),
  });

  const url = `https://dapi.kakao.com/v3/search/book?${params}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP 오류! 상태 코드: ${response.status}`);
  }

  return response.json();
}

// 썸네일/내용 있는 "가장 그럴듯한" 1권 고르기
function pickBestDocument(documents = []) {
  return documents.find((d) => d.thumbnail && d.thumbnail !== "" && d.contents && d.contents !== "");
}

// 안전한 텍스트 출력(간단 XSS 방지)
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ==========================
// 2) 섹션 채우기 공통 함수
// ==========================
async function fillSection({ boxSelector, queries, size = 17 }) {
  const boxes = document.querySelectorAll(boxSelector);

  if (!boxes.length) {
    console.warn(`[fillSection] 요소를 못 찾음: ${boxSelector}`);
    return;
  }

  // query 개수와 박스 개수 중 작은 쪽까지만 채움
  const count = Math.min(boxes.length, queries.length);

  // 병렬로 가져오기 (빠름)
  const results = await Promise.all(
    queries.slice(0, count).map((q) => fetchBooks(q, size).catch((e) => ({ error: e })))
  );

  for (let i = 0; i < count; i++) {
    const box = boxes[i];
    const result = results[i];

    // 실패한 케이스
    if (result?.error) {
      console.error(`[fillSection] API 실패: "${queries[i]}"`, result.error);
      continue;
    }

    const doc = pickBestDocument(result.documents);
    if (!doc) {
      console.warn(`[fillSection] 표시할 doc 없음: "${queries[i]}"`);
      continue;
    }

    const title = escapeHtml(doc.title);
    const authors = escapeHtml((doc.authors || []).join(", "));
    const thumb = doc.thumbnail;
    const link = doc.url; // 카카오 도서 검색 결과 URL
    // [수정 포인트] 뱃지 조건 생성 (제목에 '체험판'이 있거나 무료 섹션인 경우)
    const isFree = title.includes("체험판") || box.classList.contains("freeb-item");
    // 2. 10% 적립 조건 (부모 요소 중 id가 new2_books_section인 것이 있는지 확인)
    const isNewSection = box.closest("#new2_books_section") !== null;

    let badgeHtml = "";
    if (isFree) {
      badgeHtml = `<div class="badge-free">1권<br>무료</div>`;
    } else if (isNewSection) {
      // 10% 적립용 클래스 badge-save 추가
      badgeHtml = `<div class="badge-free badge-save">10%<br>적립</div>`;
    }
    // box가 <a>면 실제 링크로 연결
    if (box.tagName === "A") {
      box.href = link || "#";
      box.target = "_blank";
      box.rel = "noopener";
    }

    // [수정 포인트] 구조 변경: img를 .thumb-wrap으로 감싸고 뱃지 삽입  
    box.innerHTML = `
      <div class="thumb-wrap">
        ${badgeHtml}
        <img src="${thumb}" alt="${title}">
      </div>
      <h3>${title}</h3>
      <h6>${authors}</h6>
    `;
  }
}


// ==========================
// 3) TOP7 리스트 채우기 (li 기반) + 링크 연결
//    - span.name을 <a>로 바꿔서 링크 걸어줌
// ==========================

async function fillTopList({ listSelector, queries, size = 5, genreLabel = "" }) {
  const items = document.querySelectorAll(`${listSelector} .top7__item`);
  if (!items.length) {
    console.warn(`[fillTopList] 요소를 못 찾음: ${listSelector} .top7__item`);
    return;
  }

  // ✅ 화면에는 무조건 7칸을 채운다고 가정 (li가 7개 미만이면 있는 만큼만)
  const targetCount = Math.min(7, items.length);

  // ✅ 1) 우선 placeholder로 7칸 모두 채워두기 (빈칸 방지)
  const genreText = escapeHtml(genreLabel || "장르");
  for (let i = 0; i < targetCount; i++) {
    items[i].innerHTML = `
      <a href="#" class="top7-link" aria-disabled="true" onclick="return false;">
        <div class="top7-thumb ph"></div>
        <p class="top7-meta">
          <strong class="top7-title">불러오는 중…</strong>
          <span class="top7-author">잠시만요</span>
          <span class="top7-genre">${genreText}</span>
        </p>
      </a>
    `;
  }

  // ✅ 2) 쿼리들을 돌면서 "유효한 doc"만 모아서 최대 7개까지 채움
  const filledDocs = [];

  // 병렬 fetch는 결과 없는 쿼리에도 자리를 소비하는 단점이 있어
  // "7개 채우기" 목적이면 순차(또는 제한 병렬)가 더 안정적임
  for (const q of queries) {
    if (filledDocs.length >= targetCount) break;

    try {
      const result = await fetchBooks(q, size);
      const doc = pickBestDocument(result?.documents ?? []);
      if (!doc) continue; // 결과 없으면 다음 쿼리로

      filledDocs.push({ doc, fallbackQuery: q });
    } catch (error) {
      console.error(`[fillTopList] API 실패: "${q}"`, error);
      // 실패한 건 스킵하고 계속 채우기
    }
  }

  // ✅ 3) 모은 doc들로 앞에서부터 렌더링 (번호는 아예 넣지 않음)
  for (let i = 0; i < targetCount; i++) {
    const li = items[i];
    const packed = filledDocs[i];

    // doc이 부족하면 "데이터 없음" placeholder로 유지
    if (!packed) {
      li.innerHTML = `
        <a href="#" class="top7-link" aria-disabled="true" onclick="return false;">
          <div class="top7-thumb ph"></div>
          <p class="top7-meta">
            <strong class="top7-title">추천 결과 없음</strong>
            <span class="top7-author">다른 키워드로 시도해보세요</span>
            <span class="top7-genre">${genreText}</span>
          </p>
        </a>
      `;
      continue;
    }

    const { doc, fallbackQuery } = packed;

    const title = escapeHtml(doc.title || fallbackQuery);
    const authors = escapeHtml((doc.authors || []).join(", "));
    const link = doc.url || "#";
    const thumb = doc.thumbnail || "";

    li.innerHTML = `
      <a href="${link}" target="_blank" rel="noopener" class="top7-link">
        ${thumb
        ? `<img class="top7-thumb" src="${thumb}" alt="${title}">`
        : `<div class="top7-thumb ph"></div>`
      }
        <p class="top7-meta">
          <strong class="top7-title">${title}</strong>
          <span class="top7-author">${authors || "저자 정보 없음"}</span>
          <span class="top7-genre">${genreText}</span>
        </p>
      </a>
    `;
  }
}


// ==========================
// 3) Swiper 안 링크 클릭 이슈 방지(선택)
// ==========================
// Swiper 내부에서 링크를 클릭할 때 드래그로 인식되어 클릭이 씹히는 경우가 있어,
// mousedown/touchstart 전파를 막으면 개선될 수 있음. [3](https://github.com/nolimits4web/swiper/issues/5437)[4](https://stackoverflow.com/questions/69643852/prevent-swiper-slide-move-on-click-event)
function enableSwiperLinkClicks(scopeSelector = ".swiper") {
  document.querySelectorAll(`${scopeSelector} a`).forEach((a) => {
    a.addEventListener("mousedown", (e) => e.stopPropagation());
    a.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
  });
}

// ==========================
// 4) 실제 섹션별 데이터 세팅
// ==========================
async function initBookSections() {
  try {
    // (A) #new 섹션: swiper-slide 채우기
    await fillSection({
      boxSelector: "#new .swiper-slide", // 너 기존 코드 유지
      queries: [
        "그리스 로마 신화",
        "일곱번째 배심원",
        "남편을 죽이는 서른가지 방법",
        "킬 유어 달링",
        "빚 10억이 선물해준 자유",
        "나는메트로폴리탄 미술관의",
        "행동하지 않으면 인생은 바뀌지",
        "개미 1",
        "카지노 (개정판)",
        "마침내 특이점이 시작된다",
        "처음부터 시작하는 주식투자 단타전략",
        "마음은 그렇게 치유된다",
        "이해찬 회고록",
        "조용한 회복",
        "상대적이며 절대적인 지식의 백과사전",
        "터틀의 방식",
      ],
      size: 17,
    });




    await fillSection({
      boxSelector: "section.new-books1-section .book-grid a.book-item.flex-center1",
      queries: [
        "괜찮아 나도 그랬으니까",
        "GPT로 월 100만원",
        "폴란드의 비밀 양육원",
        "혁신패권",
        "퇴직 후 50년",
        "이명(Tinnitus) 평가 및 재활 워크북",
        "괜찮지 않은 날에도 괜찮은 척한",
        "헤르만 헤세의 나로",
        "문화의 패턴",
        "지적질 늑대",
      ],
      size: 10,
    });



    await fillSection({
      boxSelector: "#new2_books_section .swiper-slide a.book-item.flex-center",
      queries: [
        "킬 유어 달링",
        "죽여 마땅한 사람들",
        "살려마땅한 사람들",
        "여덟 건의 완벽한 살인",
        "살인 재능",
        "아홉 명의 목숨",
        "312호에서는 303호 여자가 보인다",
        "그녀는 증인의 얼굴을 하고 있었다",
        "아낌없이 뺏는 사랑"
      ],
      size: 7
    });


    await fillSection({
      boxSelector: "section.freeb-section .book-grid a.book-item.freeb-item.flex-center",
      queries: [
        "(밀레니엄 2권)불을 가지고 노는",
        "게으른 게 아니라 충전중입니다",
        "왜 나는 항상 연애가 어려울까",
        "대륙상술사[체험판]",
        "소나기밥 공주",
      ],
      size: 5,
    });


    // ✅ TOP7: id로 정확히 잡기

    await fillTopList({
      listSelector: "#top7List1",
      queries: [
        "시민참여론",
        "대영웅",
        "투자자산운용사 실제유형",
        "마케팅",
        "현대사회와 스포츠:미래",
        "형사소송법 제11판",
        "형사소송법",
        "그리스 로마 신화",
      ],
      size: 8,
      genreLabel: "전체",   // ✅ 표시될 장르(원하면 바꿔)
    });

    await fillTopList({
      listSelector: "#top7List2",
      queries: [
        "불편한 편의점",
        "무법자",
        "세계 추리소설 필독서 50",
        "계절이 지나 나로 남다",
        "양들의 침묵",
        "남편들을 죽이는 서른가지",
        "소년이 온다",
      ],
      size: 8,
      genreLabel: "문학",
    });

    await fillTopList({
      listSelector: "#top7List3",
      queries: [
        "진보를 위한 주식투자",
        "디지털경영",
        "차이나 마케팅",
        "현명한 투자자 1",
        "실패를 성공으로 바꾸는",
        "단 3개의 미국 ETP로 은퇴",
        "30분만에 타로마스터 되는 방법",
        "투자자산운용사",
        "2025~2026파생상품투자"
      ],
      size: 8,
      genreLabel: "경제/경영",
    });


    // ✅ 서점 1권(제목만)
    await fillSection({
      boxSelector: "section.bj-section .book-grid a.book-item",
      queries: ["킬 유어 달링"],
      size: 10,

    });

    // ✅ 이 분야의 베스트 5권(저자 포함)
    await fillSection({
      boxSelector: "section.best-field .book-grid a.book-item",
      queries: [
        "양들의 침묵",
        "추리 소설단편",
        "에이전트 AGENT",
        "만능감정사 Q의 사건수첩",
        "법의관"
      ],
      size: 4,

    });



    // Swiper 안 링크 클릭 문제 있으면 활성화
    enableSwiperLinkClicks(".swiper");
  } catch (error) {
    console.log("에러발생", error);
  }
}

// DOM 준비 후 실행
document.addEventListener("DOMContentLoaded", initBookSections);
const categoryButtons = document.querySelectorAll('.category-list__btn');
const chartTitle = document.querySelector('.chart-header-main .section__title');

categoryButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    categoryButtons.forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    const categoryName = btn.textContent.replace(' >', '');
    chartTitle.textContent = categoryName + ' 베스트';
  });
});