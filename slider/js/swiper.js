var swiper = new Swiper(".newSwiper", {
      slidesPerView: 5, //화면에 보이는 개수
      spaceBetween: 30,
      loop: true, // 무한 루프
      pagination: {
        el: ".swiper-pagination",
        clickable: true,
      },
      navigation: {
        nextEl: "#new .swiper-button-next",
        prevEl: "#new .swiper-button-prev",
      }
    });