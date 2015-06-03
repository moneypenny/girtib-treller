var React = window.React = require('react'),
    mountNode = document.getElementById('app'),
    Config = require('./config.json'),
    Router = require('react-router');
var {
  Route,
  DefaultRoute,
  NotFoundRoute,
  RouteHandler,
  Link
} = Router;

var GirtibTrellerApp = React.createClass({
  render: function() {
    return (
      <div>
        <RouteHandler/>
      </div>
    );
  }
});

var LocalStorage = (function() {
  return {
    getJSON: function() {
      if (!window.localStorage) {
        console.error('browser does not support local storage');
        return {};
      }
      var appData = window.localStorage.getItem(Config.localStorageKey) || "{}";
      return JSON.parse(appData);
    },
    get: function(key) {
      var appData = this.getJSON();
      return appData[key];
    },
    set: function(key, value) {
      var appData = this.getJSON();
      appData[key] = value;
      window.localStorage.setItem(Config.localStorageKey, JSON.stringify(appData));
    },
    delete: function(key) {
      var appData = this.getJSON();
      delete appData[key];
      window.localStorage.setItem(Config.localStorageKey, JSON.stringify(appData));
    }
  };
})();

var Github = (function() {
  return {
    apiUrl: 'https://api.github.com',
    getHeaders: function() {
      return {
        'Authorization': 'token ' + LocalStorage.get('token')
      };
    },
    getOrgs: function() {
      return $.ajax({
        dataType: 'json',
        url: this.apiUrl + '/user/orgs',
        headers: this.getHeaders()
      })
    },
    getOrgNames: function() {
      return $.Deferred(function(defer) {
        var orgNames = LocalStorage.get('orgNames');
        if (orgNames) {
          defer.resolve(orgNames);
        } else {
          orgNames = [];
          this.getOrgs().success(function(orgs) {
            for (var i=0; i<orgs.length; i++) {
              orgNames.push(orgs[i].login);
            }
            LocalStorage.set('orgNames', orgNames);
            defer.resolve(orgNames);
          }).error(defer.reject);
        }
      }.bind(this)).promise();
    },
    getUserRepos: function() {
      return $.ajax({
        dataType: 'json',
        url: this.apiUrl + '/user/repos',
        headers: this.getHeaders()
      });
    },
    getOrgRepos: function(orgName) {
      return $.ajax({
        dataType: 'json',
        url: this.apiUrl + '/orgs/' + orgName + '/repos',
        headers: this.getHeaders()
      });
    },
    getAllOrgRepos: function(orgNames) {
      return $.Deferred(function(defer) {
        var statuses = {};
        var allRepos = [];
        var resolveIfNecessary = function() {
          var finished = true;
          for (var orgName in statuses) {
            var status = statuses[orgName];
            if (status === 'pending') {
              finished = false;
            }
          }
          if (finished) {
            console.log('finished fetching repos', allRepos);
            defer.resolve(allRepos);
          }
        };
        orgNames.forEach(function(name) {
          statuses[name] = 'pending';
          this.getOrgRepos(name).success(function(orgRepos) {
            allRepos = allRepos.concat(orgRepos);
            statuses[name] = 'success'
            resolveIfNecessary();
          }).error(function() {
            statuses[name] = 'failure';
            resolveIfNecessary();
          });
        }.bind(this));
      }.bind(this)).promise();
    },
    getRepos: function() {
      return $.Deferred(function(defer) {
        this.getUserRepos().then(function(userRepos) {
          this.getOrgNames().then(function(orgNames) {
            this.getAllOrgRepos(orgNames).then(function(orgRepos) {
              defer.resolve(userRepos.concat(orgRepos));
            }, defer.reject);
          }.bind(this), defer.reject);
        }.bind(this), defer.reject);
      }.bind(this)).promise();
    }
  };
})();

var Index = React.createClass({
  mixins : [Router.Navigation],
  componentWillMount: function() {
    var token = LocalStorage.get('token');
    if (token) {
      this.transitionTo('commits');
    }
  },
  getInitialState: function() {
    return {
      authUrl: Config.apiUrl + '/auth/github'
    };
  },
  render: function() {
    return (
      <div>
        <h1>Girtib Treller</h1>
        <p><a href={this.state.authUrl}>Sign in with Github</a></p>
      </div>
    );
  }
});

var AuthFailure = React.createClass({
  render: function() {
    return (
      <p>
        Something went wrong with your Github authentication. Please
        <a href="/#/">try again</a>.
      </p>
    );
  }
});

var Auth = React.createClass({
  mixins : [Router.Navigation],
  contextTypes: {
    router: React.PropTypes.func
  },
  render: function() {
    var router = this.context.router;
    var token = this.context.router.getCurrentParams().token;
    LocalStorage.set('token', token);
    this.transitionTo('commits');
    return <p></p>;
  }
});

var RepoListItem = React.createClass({
  render: function() {
    return (
      <li>{this.props.repo.owner.login}/{this.props.repo.name}</li>
    );
  }
});

var CommitsList = React.createClass({
  getInitialState: function() {
    return {repos: []};
  },
  componentDidMount: function() {
    Github.getRepos().then(function(repos) {
      console.log(repos.length, 'repositories');
      console.log(repos);
      this.setState({repos: repos});
    }.bind(this), function() {
      console.error('failed to fetch all repositories');
    });
  },
  render: function() {
    var listItems = [];
    for (var i=0; i<this.state.repos.length; i++) {
      var repo = this.state.repos[i];
      listItems.push(<RepoListItem repo={repo} />);
    }
    return (
      <ul>{listItems}</ul>
    );
  }
});

var Commits = React.createClass({
  render: function () {
    return (
      <div class="commits"><CommitsList /></div>
    );
  }
});

var NotFound = React.createClass({
  render: function () {
    return <h1>404 Not Found</h1>;
  }
});

var routes = (
  <Route handler={GirtibTrellerApp} path="/">
    <DefaultRoute handler={Index} />
    <Route name="authFailure" path="failed-auth" handler={AuthFailure}/>
    <Route name="auth" path="auth/:token" handler={Auth}/>
    <Route name="commits" path="commits" handler={Commits}/>
    <NotFoundRoute handler={NotFound}/>
  </Route>
);

Router.run(routes, function(Handler) {
  React.render(<Handler/>, mountNode);
});
