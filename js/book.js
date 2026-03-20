
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

    // box가 <a>면 실제 링크로 연결
    if (box.tagName === "A") {
      box.href = link || "#";
      box.target = "_blank";
      box.rel = "noopener";
    }

    box.innerHTML = `
      <img src="${thumb}" alt="${title}">
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

  // ✅ 1~6까지만, 최대 6칸
  const count = Math.min(6, items.length, queries.length);

  const results = await Promise.all(
    queries.slice(0, count).map(q => fetchBooks(q, size).catch(error => ({ error })))
  );

  for (let i = 0; i < count; i++) {
    const li = items[i];
    const result = results[i];

    if (result?.error) {
      console.error(`[fillTopList] API 실패: "${queries[i]}"`, result.error);
      continue;
    }

    const doc = pickBestDocument(result.documents);
    if (!doc) continue;

    const title = escapeHtml(doc.title || queries[i]);
    const authors = escapeHtml((doc.authors || []).join(", "));
    const link = doc.url || "#";
    const thumb = doc.thumbnail || "";

    // ✅ 랭크 1~6
    const rankEl = li.querySelector(".rank");
    if (rankEl) rankEl.textContent = String(i + 1);

    // ✅ Kakao 책 API에는 "장르" 필드가 없는 경우가 많아서,
    // 컬럼별로 전달한 genreLabel을 표시하도록 처리 (원하는 장르명 넣으면 됨)
    const genreText = escapeHtml(genreLabel || "장르");

    // ✅ li 전체를 썸네일 + p(제목/저자/장르) 구조로 렌더링 + 링크 연결
    li.innerHTML = `
      <span class="rank">${i + 1}</span>
      <a href="${link}" target="_blank" rel="noopener" class="top7-link">
        ${thumb ? `<img class="top7-thumb" src="${thumb}" alt="${title}">` : `<div class="top7-thumb ph"></div>`}
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
        "[고화질]그리스 로마 신화",
        "일곱번째 배심원",
        "글쓰기를 처음 시작 했습니다(개정2판)",
        "남편을 죽이는 서른가지 방법",
        "킬 유어 달링",
        "빚 10억이 선물해준 자유",
        "나는메트로폴리탄 미술관의",
        "행동하지 않으면 인생은 바뀌지",
        "개미 1 (개정판)",
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
        "2025 하루 1시간 ChatGPT로 월100",
        "폴란드의 비밀 양육원",
        "혁신패권",
        "퇴직 후 50년",
        "이명(Tinnitus) 평가 및 재활 워크북",
        "괜찬지 않은 날에도 괜찮은 척한",
        "[오디오북]헤르만 헤세의 나로",
        "문화이 패턴",
        "[오디오북]지적질 늑대",
      ],
      size: 10,
    });

  
    await fillSection({
      boxSelector: "section.new2-books-section .book-grid a.book-item.flex-center",
      queries: [
        "킬 유어 달링",
        "죽여 마땅한 사람들",
        "살려마땅한 사람들",
        "여덟 건의 완벽한 살인",
        "살인 재능",
      ],
      size: 5,
    });

    await fillSection({
      boxSelector: "section.freeb-section .book-grid a.book-item.freeb-item.flex-center",
      queries: [
        "(밀레니엄 2권)불을 가지고 노는",
        "게으른 게 아니라 충전중입니다",
        "왜 나는 항상 연애가 어려울까",
        "대륙상술사[체험판]",
        "소나기밥 공주 (체험판)",
      ],
      size: 5,
    });

    
    // ✅ TOP7: id로 정확히 잡기
    
    await fillTopList({
      listSelector: "#top7List1",
      queries: [
        "시민참여론(제2판)",
        "대영웅",
        "투자자산운용사 실제유형",
        "마케팅(제2판)",
        "현대사회와 스포츠:미래",
        "형사소송법 제11판",
        "추가 도서 1",
      ],
      size: 5,
      genreLabel: "전체",   // ✅ 표시될 장르(원하면 바꿔)
    });

    await fillTopList({
      listSelector: "#top7List2",
      queries: [
        "불편한 편의점",
        "무법자",
        "세계 추리소설 필독서 50",
        "계절이 지나 나로 남다",
        "양들의 침묵(개정판)",
        "남편들을 죽이는 서른가지",
        "추가 도서 1",
      ],
      size: 5,
      genreLabel: "문학",
    });

    await fillTopList({
      listSelector: "#top7List3",
      queries: [
        "진보를 위한 주식투자",
        "디지털경영(제4판)",
        "차이나 마케팅(제6판)",
        "현명한 투자자 1 (개정4판)",
        "실패를 성공으로 바꾸는",
        "단 3개의 미국 ETP로 은퇴",
        "추가 도서 1",
      ],
      size: 5,
      genreLabel: "경제/경영",
    });


    // Swiper 안 링크 클릭 문제 있으면 활성화
    enableSwiperLinkClicks(".swiper");
  } catch (error) {
    console.log("에러발생", error);
  }
}

// DOM 준비 후 실행
document.addEventListener("DOMContentLoaded", initBookSections);
