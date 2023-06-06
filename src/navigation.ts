
type Pages = "about" | "select" | "view" | "advanced";

var currentPage : Pages;

function highlightCurrentTab() : void {
    const activeClassName = "tab-active";
    // Remove the class from everyone from everyone.
    $(".tab").removeClass(activeClassName);
    // Use the current page to decide who 
    // to give it back to.
    const searching = ".tab-" + currentPage;
    $(searching).addClass(activeClassName);
}

function showPageContent() : void {
    const activeClassName = "section-active";
    // Remove the class from everyone from everyone.
    $(".section").removeClass(activeClassName);
    // Use the current page to decide who 
    // to give it back to.
    const searching = ".section-" + currentPage;
    $(searching).addClass(activeClassName);
}

function switchToSelectedPage() : void {
    highlightCurrentTab();
    showPageContent();
}

function switchToPage(page : Pages) : void {
    currentPage = page;
    switchToSelectedPage();
}

function initNavigation() : void {
    console.debug("Navigation setup")

    switchToPage("about")

    // Get when a tab is clicked
    $(".tab").on("click", e=>{
        const classes = e.target.classList;
        if (classes.contains("tab-about")) currentPage = "about";
        if (classes.contains("tab-select")) currentPage = "select";
        if (classes.contains("tab-view")) currentPage = "view";
        // if (classes.contains("tab-advanced")) currentPage = "advanced";
        if (classes.contains("tab-advanced")) {
            alert("Haven't done that part yet :)")
            // currentPage = "advanced";
            currentPage = "about"
        }
        switchToSelectedPage();
    })

    $(".switch-to-select").on("click", () => switchToPage("select"))
}
