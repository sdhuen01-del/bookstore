 // 1. 슬라이더
    var swiper = new Swiper(".newSwiper", {
      slidesPerView: 5, //화면에 보이는 개수
      spaceBetween: 30,
      loop: true, // 무한 루프
      pagination: {
        clickable: true,
      },
      navigation: {
        nextEl: "#new .swiper-button-next",
        prevEl: "#new .swiper-button-prev",
      }
    });
    // 2. 이벤트
    const eventSwiper = new Swiper(".eventSwiper", {
      slidesPerView: 3,
      spaceBetween: 5,
      loop: true,
      navigation: {
        nextEl: "#event .swiper-button-next",
        prevEl: "#event .swiper-button-prev",
      }
    });

    // 3. 배너
    const bannerSwiper = new Swiper(".bannerSwiper", {
      slidesPerView: 3,
      spaceBetween: 5,
      loop: true,
      navigation: {
        nextEl: "#banner .swiper-button-next",
        prevEl: "#banner .swiper-button-prev",
      }
    });

    // 4.피터 스완슨
    const new2_books_sectionSwiper = new Swiper(".new2_books_sectionSwiper", {
      slidesPerView: 5,
      spaceBetween: 10,
      loop: true,
      navigation: {
        nextEl: "#new2_books_section .swiper-button-next",
        prevEl: "#new2_books_section .swiper-button-prev",
      }
    });