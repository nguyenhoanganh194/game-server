# DS-project
 The DS project oulu course
## Project Instructions:

 ```python

 #Test
@app.route("/user/add/",methods=["POST"])
def add_user():
    try:
        user = models.User(
            id = 12,
            user_name = "12",
            password = "12"
        )
        models.db.session.add(user)
        models.db.session.commit()
        return "Successful",201
    except:
        return "User already exists",409


```

