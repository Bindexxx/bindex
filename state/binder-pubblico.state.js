// Stato di binder-pubblico.html.

let carte = [];
        let _binderId = null;
        let _ownerUserId = null;
        let _binderInfo = null;
        let _binderPagina = 0;
        let _modalita = 'elenco';
        let _flipCardTimeout = null;
        let _sleeveRisolta = null;
        let selezioni = {};
        const _nomeProprietarioWishlist = new URLSearchParams(window.location.search).get('nome');
